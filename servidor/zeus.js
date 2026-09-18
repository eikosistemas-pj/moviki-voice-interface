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
//   ZEUS_SENHA          a tranca. Sem ela, os olhos nao abrem
//   ZEUS_GITHUB_TOKEN   sem ele o Zeus conversa mas nao trabalha
//   ZEUS_LIMITE_DIA     opcional. Padrao 200 falas por dia.
//   ZEUS_PORTA          opcional. Padrao 8124.
//   ZEUS_ESTADO         opcional. Onde guardar a memoria. Padrao ./dados/
//   ZEUS_MODELO         opcional. Ver servidor/cerebro.js.
//
// AS TRES COISAS QUE ELE FAZ, E EM QUE ORDEM
//   1. abre e fecha o turno          (frase falada, conferida pela trava)
//   2. trabalha                      (ordem com verbo de mudanca -> Pull Request)
//   3. conversa                      (todo o resto -> cerebro)
//
// Trabalho corre POR FORA da conversa: ler codigo leva minutos e o Paulo esta
// parado na frente da tela esperando uma voz.

import http from 'node:http'
import { decidir, PEDIDOS } from '../lib/turno.js'
import { entender, pareceAnalise, pareceTrabalho, repoDoAssunto } from './comando.js'
import { montarSystem, pensarEmFluxo } from './cerebro.js'
import { partirFala } from '../lib/partirFala.js'
import * as estado from './estado.js'
import * as olhos from './olhos.js'
import { montarAviso } from './aviso.js'
import * as fatos from './fatos.js'
import { avaliar } from './vigia.js'
import { criarPorta } from './porta.js'
import { executarProposta } from './oficina.js'
import { montarProposta } from './trabalho.js'
import { analisar } from './analise.js'
import * as patrulha from './patrulha.js'

const PORTA = Number(process.env.ZEUS_PORTA || 8124)
const LIMITE_DIA = Number(process.env.ZEUS_LIMITE_DIA || 200)

/**
 * PRAZO DE UMA TAREFA. Nenhuma pode ser imortal.
 *
 * O Paulo pediu a cor de um botao de manha e a tarde ainda ouvia "esta em
 * andamento". A tarefa tinha morrido e ficado gravada como "trabalhando" para
 * sempre — nunca entrava na fila do que o Zeus tem para contar.
 *
 * Passado o prazo ela vira FALHA, e falha ele conta. Melhor ouvir "nao deu, me
 * mande tentar de novo" em doze minutos do que esperar seis horas por um aviso
 * que nao vem.
 */
const PRAZO_TAREFA = Number(process.env.ZEUS_PRAZO_TAREFA || 12 * 60 * 1000)

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

// A PORTA. A senha mora so aqui e nunca vai para a tela — ao contrario do
// ZEUS_TOKEN, que viajava para dentro da pagina e qualquer um lia no codigo
// dela. Ver servidor/porta.js.
const porta = criarPorta({ senha: process.env.ZEUS_SENHA })

// OS OLHOS SO ABREM COM A PORTA TRANCADA.
//
// Enquanto o Zeus sabia apenas o folheto da empresa, porta fraca era
// aborrecimento pequeno. Sabendo de tudo — o mapa mestre, o que mudou em cada
// repositorio — a mesma porta entrega a empresa inteira a quem descobrir o
// endereco. Entao a regra e dura e nao se discute em tempo de execucao: sem
// senha configurada, ele continua atendendo, mas de olhos fechados.
const OLHOS_LIGADOS = porta.exigeSenha() && process.env.ZEUS_OLHOS !== '0'

/** Frases fixas. Nao gastam chamada paga: sao respostas de porta, nao de ideia. */
const FALAS = {
  semToken: 'Nao reconheci de onde veio esse pedido.',
  semCracha: 'Preciso que voce se identifique antes de falar comigo.',
  senhaErrada: 'Essa senha nao e a minha.',
  portaTrancada: 'Errou demais. Espere quinze minutos.',
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
  vouTrabalhar: 'Vou trabalhar nisso. Te conto quando terminar.',
  vouOlhar: 'Vou olhar o codigo agora. Ja te respondo.',
  // A frase antiga era verdadeira e inutil: dizia que faltava o token e
  // acabava ali. Nao dizia se nunca foi posto, se foi apagado ou se venceu — e
  // cada uma tem conserto diferente. Agora ela termina com o que fazer.
  semOficina:
    'Nao tenho o token do GitHub aqui, entao nao consigo mexer no codigo. ' +
    'Rode o doutor na VPS que ele diz exatamente o que fazer.',
  ondeMexer: 'Nao entendi em qual parte do Moviki e para mexer. Me diga o painel, o site, o atendente ou as redes.',
  ondeOlhar: 'Nao entendi qual parte do Moviki e para eu olhar. Me diga o painel, o site, o atendente ou as redes.',
}

/**
 * Acrescenta a previsao de tempo, quando ela for HONESTA.
 *
 * O Paulo pediu para saber quanto tempo vai levar. A previsao sai do que o
 * proprio Zeus levou nas ultimas vezes — nunca de chute. Sem historico
 * suficiente ele nao promete nada: prazo inventado e estourado toda vez
 * destroi a confianca mais rapido do que nenhum prazo.
 */
function comPrazo(fala, atual, tipo) {
  const min = estado.minutosTipicos(atual, tipo)
  if (!min) return fala
  return `${fala} Costuma levar uns ${min} ${min === 1 ? 'minuto' : 'minutos'}.`
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

/**
 * ABRE O CANO ATE A TELA.
 *
 * POR QUE NAO E MAIS UM JSON SO — 18/09/2026, segunda rodada
 * Antes esta rota so respondia quando a resposta estava pronta INTEIRA. A
 * tela entao mandava o texto todo para a voz, que so entao comecava a
 * sintetizar. Tres esperas em fila, e o Paulo de boca fechada nas tres.
 *
 * Agora cada FRASE PRONTA sai assim que existe, uma linha de JSON por vez
 * (NDJSON). A tela sintetiza a primeira enquanto o Zeus ainda pensa a
 * segunda. Resposta inteira demora o mesmo; a primeira palavra demora uma
 * fracao — e e essa que ele chama de demora.
 *
 * `X-Accel-Buffering: no` e para o dia do Nginx: sem isso ele segura o fluxo
 * e entrega tudo junto no fim, desfazendo exatamente este conserto.
 */
function abrirFluxo(res, codigo = 200) {
  res.writeHead(codigo, {
    'Content-Type': 'application/x-ndjson; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Accel-Buffering': 'no',
  })
  const linha = (obj) => {
    if (res.writableEnded || res.destroyed) return
    res.write(`${JSON.stringify(obj)}\n`)
  }
  return {
    /** Um pedaco JA partido, do jeito que veio do cerebro. */
    pedaco: (texto) => linha({ t: 'fala', texto }),
    /** Uma frase inteira ainda por partir (as falas fixas do Zeus). */
    fala: (texto) => {
      for (const p of partirFala(texto)) linha({ t: 'fala', texto: p })
    },
    fim: (extra) => {
      linha({ t: 'fim', ...extra })
      if (!res.writableEnded) res.end()
    },
  }
}

/** Resposta de uma frase so: abre, fala, fecha. */
function responderFala(res, codigo, texto, extra) {
  const canal = abrirFluxo(res, codigo)
  canal.fala(texto)
  canal.fim(extra)
}

async function tratarFala(req, res) {
  let corpo
  try {
    corpo = await lerCorpo(req)
  } catch {
    return responderFala(res, 400, FALAS.vazio, {})
  }

  // O cracha vem da porta (POST /api/zeus/entrar). O ZEUS_TOKEN antigo saiu
  // de cena: ele viajava para dentro da pagina e qualquer um lia no codigo.
  if (!porta.vale(corpo.cracha)) {
    return responderFala(res, 401, FALAS.semCracha, { precisaEntrar: true })
  }

  const falado = String(corpo.texto || '').trim()
  const atual = estado.ler()

  const pedido = entender(falado)
  if (!pedido.tipo) {
    return responderFala(res, 200, FALAS.vazio, { turno: atual.turno })
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
      return responderFala(res, 200, fala, { turno: atual.turno })
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
    return responderFala(
      res,
      200,
      CONFERE_VOZ ? FALAS.assumi : FALAS.assumiSemProva,
      { turno: atual.turno }
    )
  }

  // --- Fechar o turno -----------------------------------------------------
  if (pedido.tipo === PEDIDOS.FECHAR_TURNO) {
    if (veredito.motivo === 'ja_estava_fechado') {
      return responderFala(res, 200, FALAS.jaFechado, { turno: atual.turno })
    }
    const fala = relatorio(atual)
    atual.turno = { aberto: false, fechadoEm: new Date().toISOString() }
    estado.anotar(atual, { o: 'turno_fechado', resumo: 'devolvi o posto' })
    estado.gravar(atual)
    return responderFala(res, 200, fala, { turno: atual.turno })
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
    return responderFala(res, 200, fala, { turno: atual.turno })
  }

  // --- Trabalho: aqui comeca a gastar -------------------------------------
  const teto = estado.passouDoTeto(atual, LIMITE_DIA)
  if (teto.estourou) {
    return responderFala(res, 200, FALAS.teto, { turno: atual.turno })
  }

  // --- Ordem de mexer no codigo -------------------------------------------
  //
  // So entra aqui quem tem VERBO DE MUDANCA. "Como esta o painel?" e conversa
  // e segue para o cerebro; "muda o texto do painel" e trabalho.
  //
  // O trabalho corre POR FORA: ler o codigo e montar a alteracao leva minutos,
  // e o Paulo esta parado na frente da tela esperando uma voz. Ele ouve "vou
  // trabalhar nisso" na hora, e o resultado e contado quando ele falar de novo.
  if (pareceTrabalho(falado)) {
    const repo = repoDoAssunto(falado)
    if (!repo) {
      return responderFala(res, 200, FALAS.ondeMexer, { turno: atual.turno })
    }
    if (!process.env.ZEUS_GITHUB_TOKEN) {
      return responderFala(res, 200, FALAS.semOficina, { turno: atual.turno })
    }

    const id = estado.abrirTarefa(atual, { ordem: falado, repo })
    estado.anotar(atual, { o: 'trabalho', resumo: `comecei: ${falado.slice(0, 100)}` })
    estado.gravar(atual)

    // De proposito sem `await`: a resposta sai agora. O `.then` grava o
    // resultado quando chegar, lendo o estado DE NOVO — entre o inicio e o
    // fim o Paulo pode ter falado outras coisas, e gravar por cima da copia
    // velha apagaria a conversa dele.
    montarProposta({ repo, ordem: falado })
      .then(async (r) => {
        // A pergunta viaja junto: e ela que o Zeus vai FALAR, no lugar de um
        // "nao deu" seco que obrigaria o Paulo a pedir tudo de novo.
        if (!r.ok) return { ok: false, erros: r.erros, pergunta: r.pergunta }
        return executarProposta(r.proposta)
      })
      .then((r) => {
        const agora = estado.ler()
        estado.fecharTarefa(agora, id, r)
        estado.anotar(agora, {
          o: 'trabalho',
          resumo: r.ok ? `abri um Pull Request: ${r.link}` : `nao deu: ${(r.erros || []).join('; ')}`,
        })
        estado.gravar(agora)
      })
      .catch((e) => {
        const agora = estado.ler()
        estado.fecharTarefa(agora, id, { ok: false, erros: [String(e?.message || e)] })
        estado.gravar(agora)
      })

    return responderFala(res, 200, comPrazo(FALAS.vouTrabalhar, atual, 'trabalho'), {
      turno: atual.turno,
    })
  }

  // --- Pedido de OLHAR o codigo e responder -------------------------------
  //
  // Sem verbo de mudanca, entao nao e trabalho: ninguem vai abrir Pull
  // Request. Mas tambem nao e conversa pura, porque a resposta certa esta no
  // CODIGO, e na conversa ele so tem o retrato.
  //
  // Este caminho existe porque o Paulo pediu "analise o painel do parceiro" e
  // nao aconteceu nada. Ele tinha olhos para ler, mas os olhos so abriam
  // dentro do caminho que termina em Pull Request.
  //
  // So entra aqui quando da para saber DE QUAL parte do Moviki ele fala. Sem
  // isso, segue para a conversa — que responde no geral, como sempre
  // respondeu. Falso negativo aqui nao quebra nada.
  if (pareceAnalise(falado)) {
    const repo = repoDoAssunto(falado)
    if (!repo) {
      // PERGUNTAR ONDE, EM VEZ DE RESPONDER POR CIMA DO RETRATO.
      //
      // 18/09/2026: o Paulo pediu "analise o repositorio Moviki App" e, sem
      // repositorio identificado, o pedido caia na conversa — que so tem o
      // retrato (que ramo, que commit), nao o codigo. O Zeus respondia com
      // honestidade que nao dava para analisar de verdade, e o Paulo ficava
      // com a impressao de que a ferramenta de leitura estava quebrada.
      //
      // Ela nao estava: ele nunca chegou a abrir os olhos. Uma pergunta de uma
      // frase resolve, e nao deixa duvida sobre o que aconteceu.
      return responderFala(res, 200, FALAS.ondeOlhar, { turno: atual.turno })
    }
    if (repo) {
      const id = estado.abrirTarefa(atual, { ordem: falado, repo, tipo: 'analise' })
      estado.anotar(atual, { o: 'analise', resumo: `fui olhar: ${falado.slice(0, 100)}` })
      estado.gravar(atual)

      // Sem `await`: a resposta sai agora. Ler codigo leva dezenas de segundos
      // e ele esta na frente da tela esperando uma voz.
      analisar({ repo, pergunta: falado })
        .then((r) => {
          const agora = estado.ler()
          estado.fecharTarefa(agora, id, r)
          estado.anotar(agora, {
            o: 'analise',
            resumo: r.ok ? `respondi sobre: ${falado.slice(0, 80)}` : `nao deu: ${(r.erros || []).join('; ')}`,
          })
          estado.gravar(agora)
        })
        .catch((e) => {
          const agora = estado.ler()
          estado.fecharTarefa(agora, id, { ok: false, erros: [String(e?.message || e)] })
          estado.gravar(agora)
        })

      return responderFala(res, 200, comPrazo(FALAS.vouOlhar, atual, 'analise'), {
        turno: atual.turno,
      })
    }
  }

  // --- Conversa: a unica rota que pensa, e a unica que corre em fluxo ------
  const visao = OLHOS_LIGADOS ? olhos.ultimoRetrato() : {}
  const pendentes = estado.tarefasParaContar(atual)
  // O que esta rodando AGORA, com o relogio. Sem isto ele inventava que
  // estava trabalhando porque tinha dito isso uma vez, horas atras.
  const emAndamento = estado.tarefasEmAndamento(atual)

  const canal = abrirFluxo(res)
  const r = await pensarEmFluxo({
    system: montarSystem({
      turnoAberto: atual.turno?.aberto === true,
      mapa: visao.mapa,
      retrato: visao.retrato,
      tarefas: pendentes,
      emAndamento,
    }),
    historico: atual.conversa,
    falaNova: falado,
    // AQUI MORA O CONSERTO DA DEMORA: cada frase pronta sai na hora, em vez
    // de a tela esperar a resposta inteira para so entao procurar a voz.
    aoPedaco: (pedaco) => canal.pedaco(pedaco),
  })

  if (!r.texto) {
    canal.fala(FALAS.semCerebro)
    return canal.fim({ turno: atual.turno })
  }

  estado.contarChamada(atual)
  // Marcadas so DEPOIS de a resposta existir: se a chamada falhasse antes,
  // o Zeus daria o trabalho por contado sem ter aberto a boca.
  if (pendentes.length) estado.marcarContadas(atual)
  estado.lembrarFala(atual, 'paulo', falado)
  estado.lembrarFala(atual, 'zeus', r.texto)
  if (atual.turno?.aberto) {
    estado.anotar(atual, { o: 'conversa', resumo: falado.slice(0, 120) })
  }
  estado.gravar(atual)

  return canal.fim({ turno: atual.turno })
}

/**
 * De onde veio o pedido. So para contar os erros de senha por endereco.
 *
 * Nao e identidade: da para forjar. Serve para o castigo por tentativa errada
 * nao ser geral — se fosse, bastaria alguem errar cinco vezes para trancar o
 * Paulo do lado de fora da propria casa.
 */
function quemEsta(req) {
  return req.socket?.remoteAddress || 'desconhecido'
}

async function tratarEntrada(req, res) {
  let corpo
  try {
    corpo = await lerCorpo(req)
  } catch {
    return responderJSON(res, 400, { erro: 'pedido invalido' })
  }

  const r = porta.entrar(corpo.senha, quemEsta(req))
  if (!r.ok) {
    const fala =
      r.motivo === 'porta_trancada' ? FALAS.portaTrancada : FALAS.senhaErrada
    // 401 sempre, com a mesma cara: dizer "usuario existe mas a senha esta
    // errada" e entregar metade do caminho a quem esta tentando.
    return responderJSON(res, 401, { resposta: fala, motivo: r.motivo })
  }
  return responderJSON(res, 200, { cracha: r.cracha })
}

const servidor = http.createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/api/zeus/entrar') {
      return await tratarEntrada(req, res)
    }
    if (req.method === 'POST' && req.url === '/api/zeus') {
      return await tratarFala(req, res)
    }
    if (req.method === 'GET' && req.url === '/api/zeus/porta') {
      // Serve para a tela saber se precisa pedir senha. Nao diz QUAL e a
      // senha nem se alguem esta dentro — so se a porta existe.
      return responderJSON(res, 200, { exigeSenha: porta.exigeSenha() })
    }
    if (req.method === 'GET' && req.url.startsWith('/api/zeus/novidade')) {
      // A TELA PERGUNTA; O SERVIDOR NAO EMPURRA.
      //
      // Navegador nao tem campainha. Montar um cano aberto so para avisar
      // seria peso a mais numa maquina de 2 GB — e esta rota nao pensa nem
      // gasta chamada paga: ela so devolve o que ja estava guardado.
      const cracha = new URL(req.url, 'http://x').searchParams.get('cracha')
      if (!porta.vale(cracha)) {
        return responderJSON(res, 401, { precisaEntrar: true })
      }

      const atual = estado.ler()
      const prontas = estado.tarefasParaContar(atual)
      const chamados = estado.chamadosPendentes(atual)
      if (!prontas.length && !chamados.length) {
        return responderJSON(res, 200, { fala: null })
      }

      // O que ele FEZ vem antes do que ele PERCEBEU: o Paulo pediu o
      // trabalho, entao a resposta ao pedido dele vem primeiro.
      const aviso = montarAviso(prontas) || { fala: '', links: [] }
      const falas = [aviso.fala, ...chamados.map((c) => c.fala)].filter(Boolean)

      // Esvaziadas assim que saem daqui: se a tela nao conseguir falar, e
      // melhor perder um aviso do que o Zeus repetir o mesmo para sempre.
      estado.marcarContadas(atual)
      estado.limparChamados(atual)
      estado.gravar(atual)
      return responderJSON(res, 200, { fala: falas.join(' '), links: aviso.links })
    }
    if (req.method === 'GET' && req.url === '/api/zeus/vivo') {
      // Sinal de vida, sem contar nada. Serve para o instalador conferir que
      // o servico subiu, e nao revela nem se o Zeus esta no comando.
      return responderJSON(res, 200, { ok: true })
    }
    if (req.method === 'GET' && req.url.startsWith('/api/zeus/turno')) {
      // ATRAS DA PORTA, e isto foi um conserto: a rota respondia a qualquer
      // um. Saber que o turno esta ABERTO e saber que o Paulo nao esta
      // olhando — exatamente o que interessa a quem quer entrar.
      const cracha = new URL(req.url, 'http://x').searchParams.get('cracha')
      if (!porta.vale(cracha)) {
        return responderJSON(res, 401, { precisaEntrar: true })
      }
      const atual = estado.ler()
      return responderJSON(res, 200, {
        turno: atual.turno,
        feitosNoTurno: estado.trilhaDoTurno(atual).length,
      })
    }
    responderJSON(res, 404, { erro: 'rota desconhecida' })
  } catch (e) {
    console.error('[zeus] erro nao previsto:', e?.message || e)
    // Com o fluxo ja aberto o cabecalho ja foi: escrever outro derrubaria a
    // conexao sem o Zeus dizer nada. Fecha o que estava aberto e pronto.
    if (res.headersSent) {
      if (!res.writableEnded) res.end()
      return
    }
    responderFala(res, 500, FALAS.semCerebro, {})
  }
})

// 127.0.0.1 de proposito: quem fala com o mundo e o Nginx, na frente. Um
// servidor de comando nao precisa estar exposto direto na internet.
/**
 * Manter o retrato fresco em segundo plano.
 *
 * De proposito NAO acontece na hora da pergunta: atualizar seis repositorios
 * leva dezenas de segundos, e o Paulo esta esperando resposta em voz alta.
 * Ele conversa com o retrato mais recente; a atualizacao corre por fora.
 */
function manterOlhosAbertos() {
  if (!OLHOS_LIGADOS) return
  const atualizar = () => {
    olhos
      .olhar({ forcar: true })
      .then(() => console.log('[zeus] retrato dos repositorios atualizado'))
      .catch((e) => console.error('[zeus] nao consegui olhar:', e?.message || e))
  }
  atualizar()
  const t = setInterval(atualizar, 15 * 60 * 1000)
  // Sem isto o temporizador segura o processo de pe na hora de encerrar.
  if (typeof t.unref === 'function') t.unref()
}

/**
 * As maos funcionam? Token presente NAO quer dizer token bom.
 *
 * Ele pode ter vencido, ter sido revogado, ou nunca ter recebido permissao nos
 * repositorios certos. Os tres dao erros diferentes na hora de abrir o Pull
 * Request — e essa hora e sempre a pior hora.
 */
function conferirMaos() {
  const token = process.env.ZEUS_GITHUB_TOKEN
  if (!token) {
    console.warn(
      '[zeus] ATENCAO: sem ZEUS_GITHUB_TOKEN. Ele conversa e analisa, mas NAO ' +
        'abre Pull Request. Conserto: bash servidor/token.sh'
    )
    return
  }
  fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'zeus-moviki',
    },
  })
    .then(async (r) => {
      if (r.ok) {
        const quem = await r.json().catch(() => ({}))
        console.log(`[zeus] maos ok: o GitHub reconhece o token (${quem.login || '?'})`)
        return
      }
      console.error(
        `[zeus] ATENCAO: o GitHub RECUSOU o token (${r.status}). ` +
          'Ele vai falhar ao abrir Pull Request. Conserto: bash servidor/token.sh'
      )
    })
    .catch((e) => console.warn('[zeus] nao consegui conferir o token agora:', e?.message || e))
}

/**
 * A RONDA — o Zeus olhando em volta sem ninguem pedir.
 *
 * De cinco em cinco minutos ele confere a maquina, a voz e os Pull Requests
 * parados. O que vira chamado quem decide e o vigia; aqui so se coleta e se
 * enfileira.
 *
 * Cinco minutos, e nao doze segundos como a pergunta da tela: a ronda custa
 * uma consulta ao GitHub por repositorio, e nada disso muda de segundo em
 * segundo. O Paulo continua sendo avisado na primeira brecha em que ele nao
 * estiver falando.
 */
function ronda() {
  const atual = estado.ler()

  // Primeiro enterra o que passou do prazo. Isso vem ANTES de tudo porque e o
  // unico jeito de uma tarefa morta virar aviso: enquanto ela estiver como
  // "trabalhando", ela nao entra em fila nenhuma e o Paulo espera para sempre.
  const mortas = estado.enterrarOrfas(atual, {
    limiteMs: PRAZO_TAREFA,
    motivo: 'passou do prazo e eu parei',
  })
  if (mortas.length) {
    for (const t of mortas) {
      console.warn(`[zeus] tarefa estourou o prazo: ${t.ordem}`)
    }
    estado.gravar(atual)
  }

  const teto = estado.passouDoTeto(atual, LIMITE_DIA)

  fatos
    .coletar({ usadasHoje: teto.chamadas, limiteDia: LIMITE_DIA })
    .then((visto) => {
      const chamado = avaliar(visto, atual.chamadosDados || {})
      if (!chamado) return
      const agora = estado.ler()
      estado.enfileirarChamado(agora, chamado.chave, chamado.fala)
      estado.gravar(agora)
      console.log(`[zeus] vou chamar o Paulo: ${chamado.chave}`)
    })
    .catch((e) => console.error('[zeus] a ronda falhou:', e?.message || e))
}

/**
 * A PATRULHA — ele lendo o codigo sem ninguem pedir.
 *
 * O `vigia` da ronda percebe coisa da MAQUINA (memoria, voz, Pull Request
 * parado) — contas que o servidor faz de graca. A patrulha e o degrau
 * seguinte: ela LE O CODIGO procurando problema, e e o primeiro pedaco do Zeus
 * que gasta dinheiro sem ninguem ter pedido.
 *
 * Por isso os freios moram aqui, visiveis: so o que mudou, um repositorio de
 * cada vez, teto proprio por dia, e o padrao e o silencio. Ver patrulha.js.
 */
function sairEmPatrulha() {
  if (!OLHOS_LIGADOS) return
  if (process.env.ZEUS_PATRULHA === '0') return

  const atual = estado.ler()
  const hoje = estado.diaUTC()
  const jaForam = patrulha.patrulhasHoje(atual, hoje)
  if (jaForam >= patrulha.TETO_DIA) {
    console.log(`[zeus] patrulha: ja fiz ${jaForam} hoje, parando por aqui`)
    return
  }

  olhos
    .shaDosRepos()
    .then(async (commits) => {
      const alvo = patrulha.escolherAlvo(commits, patrulha.jaOlhados(atual))
      if (!alvo) {
        console.log('[zeus] patrulha: nada mudou desde a ultima olhada')
        return
      }

      console.log(`[zeus] saindo em patrulha no ${alvo}`)
      const achado = await patrulha.patrulhar({ repo: alvo })

      // Marca como visto ACONTECA O QUE ACONTECER. Sem isso, um repositorio
      // que da erro seria olhado de novo a cada rodada, para sempre.
      const agora = estado.ler()
      patrulha.marcarOlhado(agora, alvo, commits[alvo])
      patrulha.contarPatrulha(agora, hoje)

      if (achado) {
        // Passa pelas MESMAS regras do vigia: cada assunto fala uma vez e ha
        // descanso entre avisos. A patrulha nao ganha passe livre so por ter
        // custado uma chamada paga.
        const ultimo = Math.max(
          0,
          ...Object.values(agora.chamadosDados || {}).map(Number).filter(Boolean)
        )
        const desteAssunto = Number(agora.chamadosDados?.[achado.chave]) || 0
        const cedoDemais = ultimo && Date.now() - ultimo < 10 * 60 * 1000
        const repetido = Date.now() - desteAssunto < 6 * 60 * 60 * 1000

        if (cedoDemais || repetido) {
          console.log(`[zeus] patrulha achou algo no ${alvo}, mas e cedo para falar de novo`)
        } else {
          estado.enfileirarChamado(agora, achado.chave, achado.fala)
          estado.anotar(agora, { o: 'patrulha', resumo: `achei no ${alvo}: ${achado.fala.slice(0, 120)}` })
          console.log(`[zeus] patrulha vai chamar o Paulo sobre o ${alvo}`)
        }
      }

      estado.gravar(agora)
    })
    .catch((e) => console.error('[zeus] a patrulha falhou:', e?.message || e))
}

servidor.listen(PORTA, '127.0.0.1', () => {
  console.log(`[zeus] de pe em 127.0.0.1:${PORTA} — teto de ${LIMITE_DIA} falas/dia`)
  console.log(
    OLHOS_LIGADOS
      ? '[zeus] olhos ABERTOS: le o mapa e o estado dos repositorios'
      : '[zeus] olhos FECHADOS: sabe so o que esta escrito na instrucao dele'
  )
  manterOlhosAbertos()

  // QUEM ESTAVA TRABALHANDO ANTES DESTE RESTART MORREU JUNTO.
  //
  // O trabalho corre por fora, sem `await`, na memoria deste processo. Um
  // restart — ou o sistema matando o processo por falta de memoria, que numa
  // VPS de 2 GB acontece — leva o trabalho junto e deixa a tarefa gravada como
  // "trabalhando" para sempre. Nao ha o que esperar: enterra e deixa o Zeus
  // contar o que houve.
  const doInicio = estado.ler()
  const orfas = estado.enterrarOrfas(doInicio, {
    limiteMs: 0,
    motivo: 'o servidor reiniciou no meio e eu perdi o trabalho',
  })
  if (orfas.length) {
    estado.gravar(doInicio)
    console.warn(
      `[zeus] ${orfas.length} tarefa(s) ficaram orfas no restart anterior. ` +
        'Vou contar ao Paulo na proxima conversa:'
    )
    for (const t of orfas) console.warn(`[zeus]   - ${t.ordem}`)
  }

  // Primeira ronda com folga: subir o servico ja e um momento de maquina
  // ocupada, e medir memoria nessa hora daria susto por nada.
  setTimeout(ronda, 60_000)
  const rondaTimer = setInterval(ronda, 5 * 60 * 1000)
  if (typeof rondaTimer.unref === 'function') rondaTimer.unref()

  // A primeira patrulha com bastante folga: subir o servico ja e um momento de
  // maquina ocupada, e os espelhos ainda estao sendo atualizados.
  setTimeout(sairEmPatrulha, 5 * 60 * 1000)
  const patrulhaTimer = setInterval(sairEmPatrulha, patrulha.INTERVALO_MS)
  if (typeof patrulhaTimer.unref === 'function') patrulhaTimer.unref()
  console.log(
    process.env.ZEUS_PATRULHA === '0'
      ? '[zeus] patrulha DESLIGADA'
      : `[zeus] patrulha ligada: olha o codigo a cada ${Math.round(patrulha.INTERVALO_MS / 60000)} min, ate ${patrulha.TETO_DIA} vezes por dia`
  )
  // AS MAOS, CONFERIDAS AO SUBIR — nao na hora do pedido.
  //
  // O Paulo pediu uma alteracao e ouviu "nao tenho o token". Descobrir isso no
  // momento do pedido e tarde: ele ja gastou a vontade de pedir. Agora o
  // servico grita no registro assim que sobe, e diz o comando que resolve.
  conferirMaos()

  if (!porta.exigeSenha()) {
    console.warn(
      '[zeus] ATENCAO: sem ZEUS_SENHA configurada. A porta esta ABERTA — ' +
        'qualquer um que alcance este endereco fala com o Zeus. ' +
        'Rode servidor/instalar.sh para definir uma senha.'
    )
  }
  if (!CONFERE_VOZ) {
    console.warn(
      '[zeus] ATENCAO: conferencia de voz DESLIGADA (ZEUS_CONFERE_VOZ=0). ' +
        'Qualquer voz que diga a frase abre o turno, inclusive uma gravacao.'
    )
  }
})
