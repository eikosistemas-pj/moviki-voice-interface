// servidor/zeus.js  (repo: moviki-voice-interface)
//
// O SERVIDOR DO ZEUS. Roda na VPS, ao lado do zeus-voz (Kokoro).
//
// Fluxo de uma fala:
//   tela  -> POST /api/zeus { texto }
//         -> entende o que o Paulo quis (servidor/comando.js)
//         -> passa pela TRAVA (lib/turno.js)
//         -> se liberado, pensa (servidor/cerebro.js)
//         -> anota na trilha e devolve o texto
//   tela  -> manda esse texto para /api/voz, e o Zeus fala
//
// POR QUE A TRAVA RODA AQUI E NAO NA TELA
// O que esta no navegador qualquer um edita com o console aberto. Se a trava
// morasse la, bastava apagar uma linha para o Zeus assumir sozinho. Mesma
// razao pela qual dinheiro e status no Moviki sao sempre server-side.
//
// ENV (na VPS, nunca em arquivo):
//   ANTHROPIC_API_KEY   chave da API
//   ZEUS_TOKEN          senha simples que a tela manda junto  (ver abaixo)
//   ZEUS_LIMITE_DIA     opcional. Padrao 200 falas por dia.
//   ZEUS_PORTA          opcional. Padrao 8124.
//   ZEUS_ESTADO         opcional. Onde guardar a memoria. Padrao ./dados/
//   ZEUS_MODELO         opcional. Ver servidor/cerebro.js.
//
// SOBRE O ZEUS_TOKEN — leia antes de confiar nele
// Ele barra quem passa na rua, nao quem quer entrar. A tela e publica, entao
// o token viaja para o navegador e quem abrir o codigo da pagina consegue
// ler. Serve para o endereco nao ser um brinquedo aberto na internet; NAO
// serve de seguranca de verdade.
// A protecao que vale e o teto diario abaixo: mesmo que o token vaze, a conta
// para no limite em vez de crescer a noite inteira. Para fechar de verdade, o
// caminho e senha no Nginx ou liberar so o seu IP.

import http from 'node:http'
import { decidir, PEDIDOS } from '../lib/turno.js'
import { entender } from './comando.js'
import { montarPrompt, pensar } from './cerebro.js'
import * as estado from './estado.js'

const PORTA = Number(process.env.ZEUS_PORTA || 8124)
const LIMITE_DIA = Number(process.env.ZEUS_LIMITE_DIA || 200)

// CONFERENCIA DE VOZ — o portao da autonomia.
//
// Ligada (padrao), o turno so abre com a voz do Paulo reconhecida. O
// conferidor ainda nao existe na VPS, entao com ela ligada o Zeus nunca
// assume — e para um robo que ainda esta sendo moldado isso e paralisia, nao
// seguranca.
//
// O Paulo decidiu em 18/09/2026 deixar a conferencia para depois e ver o Zeus
// funcionando. Com ZEUS_CONFERE_VOZ=0, a frase falada basta para abrir o
// turno. O risco fica escrito com todas as letras: qualquer voz que diga a
// frase perto da tela assume o posto — inclusive uma gravacao.
//
// O que NAO afrouxa junto: a lista de assuntos que nunca sao do robo continua
// valendo igual, com turno aberto ou fechado. Mesmo assumindo sem prova, o
// Zeus nao aprova Pull Request, nao mexe em preco e nao encosta em dinheiro.
// O padrao no codigo continua sendo o seguro; quem afrouxa e a VPS, de
// propria mao, e o afrouxamento fica registrado na trilha a cada abertura.
const CONFERE_VOZ = process.env.ZEUS_CONFERE_VOZ !== '0'

/** Frases fixas. Nao gastam chamada paga: sao respostas de porta, nao de ideia. */
const FALAS = {
  semToken: 'Nao reconheci de onde veio esse pedido.',
  vazio: 'Nao entendi. Pode repetir?',
  teto: 'Ja falei demais hoje. Volto amanha.',
  semCerebro: 'Nao consegui pensar agora. Minha ligacao com o cerebro falhou.',
  vozNaoConferida:
    'Nao consigo confirmar que e voce. Enquanto a conferencia de voz nao estiver instalada aqui, eu nao assumo.',
  jaAberto: 'Eu ja estou no comando.',
  assumi: 'Assumi. Vou tocando e presto contas quando voce chegar.',
  assumiSemProva:
    'Assumi. Aviso que ainda nao sei conferir se e voce de verdade — qualquer voz me abriria agora.',
  jaFechado: 'Eu ja nao estava no comando.',
  assuntoDoPaulo: 'Isso e seu, nao meu. Nao mexo nisso nem no seu turno.',
  semTurno: 'Isso e decisao sua, e voce esta aqui. Me diga o que fazer.',
  naoPrevisto: 'Nao sei fazer isso e nao vou inventar. Deixei anotado.',
}

function responderJSON(res, codigo, corpo) {
  const texto = JSON.stringify(corpo)
  res.writeHead(codigo, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  res.end(texto)
}

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    let bruto = ''
    req.on('data', (p) => {
      bruto += p
      // Uma fala transcrita nao passa de alguns kilobytes. Corta o resto para
      // ninguem encher a memoria da VPS mandando um arquivo.
      if (bruto.length > 16_000) {
        reject(new Error('corpo grande demais'))
        req.destroy()
      }
    })
    req.on('end', () => {
      try {
        resolve(bruto ? JSON.parse(bruto) : {})
      } catch {
        reject(new Error('corpo invalido'))
      }
    })
    req.on('error', reject)
  })
}

/** O relatorio de chegada: o que ele fez enquanto o Paulo estava fora. */
function relatorio(atual) {
  const feitos = estado.trilhaDoTurno(atual)
  if (!feitos.length) return 'Bem-vindo de volta. Nao houve nada digno de nota.'
  const linhas = feitos.slice(-5).map((i) => i.resumo).filter(Boolean)
  return `Bem-vindo de volta. Enquanto voce esteve fora: ${linhas.join('; ')}.`
}

async function tratarFala(req, res) {
  let corpo
  try {
    corpo = await lerCorpo(req)
  } catch {
    return responderJSON(res, 400, { resposta: FALAS.vazio })
  }

  const esperado = process.env.ZEUS_TOKEN
  if (esperado && corpo.token !== esperado) {
    return responderJSON(res, 401, { resposta: FALAS.semToken })
  }

  const falado = String(corpo.texto || '').trim()
  const atual = estado.ler()

  const pedido = entender(falado)
  if (!pedido.tipo) {
    return responderJSON(res, 200, { resposta: FALAS.vazio, turno: atual.turno })
  }

  // Com a conferencia ligada, a prova ainda nao existe (o conferidor nao foi
  // instalado), entao a trava recusa. Com ela desligada por decisao do Paulo,
  // a frase falada vale como prova — e a trilha registra que foi assim.
  const vozConferida = !CONFERE_VOZ

  const veredito = decidir(atual.turno, {
    tipo: pedido.tipo,
    // O assunto sai da propria frase, nao de quem chamou: quem chama e a
    // tela, e tela nao e fonte confiavel.
    assunto: pedido.assunto || null,
    vozConferida,
  })

  // --- Abrir o turno ------------------------------------------------------
  if (pedido.tipo === PEDIDOS.ABRIR_TURNO) {
    if (!veredito.permitido) {
      estado.anotar(atual, {
        o: 'tentou_abrir_turno',
        resumo: `abertura recusada (${veredito.motivo})`,
      })
      estado.gravar(atual)
      const fala =
        veredito.motivo === 'turno_ja_aberto' ? FALAS.jaAberto : FALAS.vozNaoConferida
      return responderJSON(res, 200, { resposta: fala, turno: atual.turno })
    }
    atual.turno = {
      aberto: true,
      abertoEm: new Date().toISOString(),
      // Fica gravado NO TURNO, nao so no log: daqui a tres meses a pergunta
      // "como esse turno foi aberto?" precisa ter resposta.
      semConferenciaDeVoz: !CONFERE_VOZ,
    }
    estado.anotar(atual, {
      o: 'turno_aberto',
      resumo: CONFERE_VOZ ? 'assumi o posto' : 'assumi o posto sem conferencia de voz',
    })
    estado.gravar(atual)
    return responderJSON(res, 200, {
      resposta: CONFERE_VOZ ? FALAS.assumi : FALAS.assumiSemProva,
      turno: atual.turno,
    })
  }

  // --- Fechar o turno -----------------------------------------------------
  if (pedido.tipo === PEDIDOS.FECHAR_TURNO) {
    if (veredito.motivo === 'ja_estava_fechado') {
      return responderJSON(res, 200, { resposta: FALAS.jaFechado, turno: atual.turno })
    }
    const fala = relatorio(atual)
    atual.turno = { aberto: false, fechadoEm: new Date().toISOString() }
    estado.anotar(atual, { o: 'turno_fechado', resumo: 'devolvi o posto' })
    estado.gravar(atual)
    return responderJSON(res, 200, { resposta: fala, turno: atual.turno })
  }

  // --- Assunto vedado ou pedido estranho ----------------------------------
  if (!veredito.permitido) {
    estado.anotar(atual, { o: 'recusado', resumo: `recusei: ${veredito.motivo}` })
    estado.gravar(atual)
    const fala =
      veredito.motivo === 'assunto_e_do_paulo'
        ? FALAS.assuntoDoPaulo
        : veredito.motivo === 'sem_turno'
          ? FALAS.semTurno
          : FALAS.naoPrevisto
    return responderJSON(res, 200, { resposta: fala, turno: atual.turno })
  }

  // --- Trabalho: aqui comeca a gastar -------------------------------------
  const teto = estado.passouDoTeto(atual, LIMITE_DIA)
  if (teto.estourou) {
    return responderJSON(res, 200, { resposta: FALAS.teto, turno: atual.turno })
  }

  const resposta = await pensar({
    systemPrompt: montarPrompt({ turnoAberto: atual.turno?.aberto === true }),
    historico: atual.conversa,
    falaNova: falado,
  })

  if (!resposta) {
    return responderJSON(res, 200, { resposta: FALAS.semCerebro, turno: atual.turno })
  }

  estado.contarChamada(atual)
  estado.lembrarFala(atual, 'paulo', falado)
  estado.lembrarFala(atual, 'zeus', resposta)
  if (atual.turno?.aberto) {
    estado.anotar(atual, { o: 'conversa', resumo: falado.slice(0, 120) })
  }
  estado.gravar(atual)

  return responderJSON(res, 200, { resposta, turno: atual.turno })
}

const servidor = http.createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/api/zeus') {
      return await tratarFala(req, res)
    }
    if (req.method === 'GET' && req.url === '/api/zeus/turno') {
      const atual = estado.ler()
      return responderJSON(res, 200, {
        turno: atual.turno,
        feitosNoTurno: estado.trilhaDoTurno(atual).length,
      })
    }
    responderJSON(res, 404, { erro: 'rota desconhecida' })
  } catch (e) {
    console.error('[zeus] erro nao previsto:', e?.message || e)
    responderJSON(res, 500, { resposta: FALAS.semCerebro })
  }
})

// 127.0.0.1 de proposito: quem fala com o mundo e o Nginx, na frente. Um
// servidor de comando nao precisa estar exposto direto na internet.
servidor.listen(PORTA, '127.0.0.1', () => {
  console.log(`[zeus] de pe em 127.0.0.1:${PORTA} — teto de ${LIMITE_DIA} falas/dia`)
  if (!CONFERE_VOZ) {
    console.warn(
      '[zeus] ATENCAO: conferencia de voz DESLIGADA (ZEUS_CONFERE_VOZ=0). ' +
        'Qualquer voz que diga a frase abre o turno, inclusive uma gravacao.'
    )
  }
})
