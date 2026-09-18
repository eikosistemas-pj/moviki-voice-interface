// servidor/trabalho.js  (repo: moviki-voice-interface)
//
// O ZEUS TRABALHANDO — de ordem falada a proposta de alteracao.
//
// ---------------------------------------------------------------------------
// O ERRO QUE ESTE ARQUIVO CONSERTA — 18/09/2026
// ---------------------------------------------------------------------------
// A primeira versao dava a ele duas ferramentas: listar e ler. Ler trazia o
// ARQUIVO INTEIRO, e propor exigia devolver o ARQUIVO INTEIRO de volta.
//
// No primeiro uso real o Paulo pediu para trocar a cor de um botao e o Zeus
// ficou dez minutos sem entregar nada. O motivo estava no tamanho dos
// arquivos do Moviki:
//
//   moviki-app/index.html      568.633 caracteres
//   moviki-app/parceiro.html   327.492
//   moviki/404.html            264.808
//
// Ele lia um pedaco truncado, tentava reescrever meio milhao de caracteres,
// batia no teto da resposta e recomecava. Dez minutos queimando dinheiro
// contra uma parede — e a parede era o meu desenho, nao a maquina dele.
//
// COMO FICOU
//   buscar  acha o trecho no repositorio inteiro, sem carregar arquivo
//   ler     traz uma JANELA de linhas em volta, nao o arquivo todo
//   propor  troca um TRECHO por outro, nao reescreve nada
//
// Trocar uma cor passou de meio milhao de caracteres para algumas dezenas.
//
// AS CERCAS CONTINUAM AS MESMAS
//   1. Ele nao tem ferramenta de escrever nem de rodar comando. O que nao
//      existe nao pode ser usado torto.
//   2. Leitura e busca respeitam `podeMexer`: ele nao le o que nao pode
//      alterar. Ler segredo nao seria alteracao — seria vazamento.
//   3. Toda proposta passa pela conferencia antes da oficina, e a ancora e
//      conferida contra o arquivo de verdade AQUI, para ele poder corrigir
//      sozinho em vez de falhar no fim.

import fs from 'node:fs/promises'
import path from 'node:path'
import { podeMexer, REPOS_PERMITIDOS } from './maos.js'
import { aplicarTroca, nomearRamo, validar } from './proposta.js'

/** Onde ele LE para trabalhar: o espelho, que e so leitura. */
const ESPELHO = process.env.ZEUS_ESPELHO || '/root/eikosistemas'

/** Quantas idas e vindas antes de desistir. */
const MAX_VOLTAS = Number(process.env.ZEUS_MAX_VOLTAS || 14)

/**
 * Teto de espera por volta. Nao e economia: e a garantia de que a tarefa
 * TERMINA de um jeito ou de outro. Tarefa travada nunca vira aviso, e o Paulo
 * fica esperando uma resposta que nao existe.
 */
const TIMEOUT_VOLTA = Number(process.env.ZEUS_TIMEOUT_TRABALHO || 90_000)

/**
 * PRAZO DA TAREFA INTEIRA. O teto de voltas nao bastava.
 *
 * 14 voltas de ate 90s dao 21 minutos no pior caso — tempo demais para o Paulo
 * esperar sem noticia. E o teto de voltas so conta rodada: uma tarefa que anda
 * devagar em todas elas estoura o tempo sem estourar o teto.
 *
 * Passado o prazo ele PARA E CONTA. Falha em dez minutos vale mais que
 * silencio de seis horas: ele pode mandar tentar de novo, ou fazer na mao.
 */
const PRAZO = Number(process.env.ZEUS_PRAZO_TAREFA || 10 * 60 * 1000)

// Aqui NAO se economiza modelo. Conversar rapido e uma coisa; ler codigo e
// escrever alteracao que o Paulo vai aprovar e outra. E o trabalho corre por
// fora da conversa, entao o tempo dele nao deixa ninguem esperando na tela.
const MODELO = process.env.ZEUS_MODELO_TRABALHO || 'claude-opus-5'

/** Linhas devolvidas por leitura quando ele nao diz quantas. */
const JANELA_PADRAO = 80

/** Acima disso, ler o arquivo inteiro e desperdicio: ele usa busca. */
const ARQUIVO_PEQUENO = 24_000

/** Quantos achados a busca devolve. Mais que isso vira ruido. */
const MAX_ACHADOS = 40

const EXTENSOES = new Set([
  '.html', '.js', '.jsx', '.ts', '.tsx', '.css', '.json', '.md',
  '.py', '.yml', '.yaml', '.txt', '.svg', '.sh',
])

const FERRAMENTAS = [
  {
    name: 'buscar',
    description:
      'Acha um texto no repositorio inteiro e devolve arquivo e linha de cada ocorrencia. COMECE SEMPRE POR AQUI: e o jeito de achar o que mudar sem carregar arquivos gigantes.',
    input_schema: {
      type: 'object',
      properties: {
        termo: { type: 'string', description: 'texto a procurar, sem curingas' },
      },
      required: ['termo'],
    },
  },
  {
    name: 'ler',
    description:
      'Le um trecho de um arquivo. Informe a linha inicial para trazer so a janela em volta; sem ela, arquivos grandes vem cortados.',
    input_schema: {
      type: 'object',
      properties: {
        caminho: { type: 'string' },
        linha: { type: 'number', description: 'linha inicial (1 e a primeira)' },
        quantas: { type: 'number', description: 'quantas linhas trazer' },
      },
      required: ['caminho'],
    },
  },
  {
    name: 'listar',
    description: 'Lista os arquivos de uma pasta do repositorio.',
    input_schema: {
      type: 'object',
      properties: { pasta: { type: 'string' } },
      required: [],
    },
  },
  {
    name: 'perguntar',
    description:
      'Use quando voce procurou de verdade e NAO achou, ou quando achou mais de um lugar possivel e errar sairia caro. O Paulo ouve a pergunta em voz alta e responde. So use depois de ter tentado buscar com outras palavras.',
    input_schema: {
      type: 'object',
      properties: {
        pergunta: {
          type: 'string',
          description:
            'Uma frase, falada, direta. Diga o que voce ja tentou e o que precisa saber. Sem codigo, sem nome de arquivo soletrado.',
        },
      },
      required: ['pergunta'],
    },
  },
  {
    name: 'propor',
    description:
      'Entrega a alteracao. Para cada arquivo, diga o TRECHO EXATO a procurar e o trecho que entra no lugar. Nunca mande o arquivo inteiro.',
    input_schema: {
      type: 'object',
      properties: {
        titulo: { type: 'string', description: 'uma linha, em portugues' },
        resumo: { type: 'string', description: 'o que muda, em linguagem de negocio' },
        arquivos: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              caminho: { type: 'string' },
              procurar: {
                type: 'string',
                description:
                  'trecho EXATO do arquivo, copiado do que voce leu, grande o bastante para aparecer uma vez so',
              },
              trocar_por: { type: 'string', description: 'o que entra no lugar' },
              conteudo: {
                type: 'string',
                description: 'so para ARQUIVO NOVO, que ainda nao existe',
              },
            },
            required: ['caminho'],
          },
        },
      },
      required: ['titulo', 'resumo', 'arquivos'],
    },
  },
]

function instrucao(repo) {
  return `Voce e o ZEUS trabalhando no repositorio ${repo} do MOVIKI, a pedido do Paulo.

COMO TRABALHAR — NESTA ORDEM
1. "buscar" o texto que voce quer mudar (a cor, a palavra, o rotulo).
2. "ler" a janela em volta do achado, para ver o contexto.
3. "propor" a troca do trecho.

OS ARQUIVOS AQUI SAO ENORMES. O index.html do painel tem mais de meio milhao
de caracteres. NUNCA tente ler um arquivo desses inteiro e NUNCA tente
reescrever um arquivo inteiro — nao cabe na resposta e voce vai ficar preso.
Busque, leia o trecho, troque o trecho.

O TRECHO A PROCURAR PRECISA SER EXATO E UNICO
Copie do que voce leu, com os mesmos espacos. Pegue um pedaco grande o
bastante para aparecer uma vez so no arquivo — se aparecer duas, eu recuso e
voce vai ter que tentar de novo com um pedaco maior.

Siga o estilo do codigo que voce leu: mesma lingua nos comentarios, mesma
indentacao, mesmos nomes.

O QUE VOCE NAO FAZ
Nao mexe em regra de seguranca, rotina automatica, segredo, preco nem no mapa
mestre. Nao mexe no robo do dinheiro. Se a ordem exigir isso, nao proponha
nada: explique numa frase que aquilo e do Paulo.

Faca o MINIMO que resolve o pedido. Alteracao extra e revisao que o Paulo nao
pediu e nao vai ler.

NAO ACHOU DE PRIMEIRA? NAO DESISTA, E NAO INVENTE.
A busca ignora maiuscula e acento, mas nao adivinha sinonimo. Antes de dizer
que algo nao existe, tente:
  - o texto como ele aparece na TELA para o usuario, nao o nome tecnico;
  - uma palavra mais curta, ou so um pedaco dela;
  - o termo em ingles E em portugues;
  - "listar" a pasta para ver que arquivos existem.

Se depois disso ainda nao achou, ou se achou VARIOS lugares possiveis e errar
sairia caro, use "perguntar". O Paulo ouve a pergunta na hora e responde.

PERGUNTAR E MELHOR QUE DESISTIR, E MUITO MELHOR QUE CHUTAR. Alterar o lugar
errado gera um Pull Request que ele vai ter que ler para descobrir que esta
errado — e isso gasta o tempo dele, que e o que voce existe para poupar.`
}

function dentroDoRepo(repo, relativo) {
  const base = path.resolve(path.join(ESPELHO, repo))
  const alvo = path.resolve(path.join(base, relativo || ''))
  return alvo === base || alvo.startsWith(base + path.sep) ? alvo : null
}

/** Percorre o repositorio juntando os arquivos de texto que ele pode ver. */
async function arquivosDeTexto(repo, pasta = '', achados = []) {
  const alvo = dentroDoRepo(repo, pasta)
  if (!alvo || achados.length > 3000) return achados

  let itens = []
  try {
    itens = await fs.readdir(alvo, { withFileTypes: true })
  } catch {
    return achados
  }

  for (const item of itens) {
    if (item.name === '.git' || item.name === 'node_modules' || item.name === 'dist') {
      continue
    }
    const relativo = pasta ? `${pasta}/${item.name}` : item.name
    if (item.isDirectory()) {
      await arquivosDeTexto(repo, relativo, achados)
    } else if (EXTENSOES.has(path.extname(item.name).toLowerCase())) {
      // A busca obedece a mesma cerca da escrita: o que ele nao pode alterar,
      // ele nao ve. Ler segredo nao seria alteracao — seria vazamento.
      if (podeMexer(repo, relativo).permitido) achados.push(relativo)
    }
  }
  return achados
}

/**
 * Tira acento e baixa a caixa, para a busca nao depender de como foi escrito.
 *
 * ESTE ERA UM BUG, E CUSTOU UMA TAREFA INTEIRA — 18/09/2026
 * O Paulo pediu a cor do botao da newsletter. O Zeus procurou "newsletter", o
 * arquivo tinha "Newsletter", e a busca nao achou NADA — porque comparava
 * letra por letra, com a caixa.
 *
 * Ele entao concluiu que a newsletter nao existia na pagina, e desistiu. Uma
 * tarefa perdida por causa de uma letra maiuscula.
 *
 * O mesmo vale para acento: quem fala "cardapio" nao vai achar "cardápio".
 */
function achatar(texto) {
  return String(texto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/**
 * Acha o termo no repositorio, devolvendo arquivo, linha e a linha inteira.
 *
 * A COMPARACAO IGNORA CAIXA E ACENTO, mas o que volta e a linha ORIGINAL —
 * ele precisa do texto exato para poder trocar depois.
 */
export async function buscar(repo, termo) {
  if (!termo || termo.length < 2) return '(me diga um texto maior para procurar)'

  const alvoAchatado = achatar(termo)
  const lista = await arquivosDeTexto(repo)
  const achados = []

  for (const relativo of lista) {
    if (achados.length >= MAX_ACHADOS) break
    const alvo = dentroDoRepo(repo, relativo)
    if (!alvo) continue
    let texto = ''
    try {
      texto = await fs.readFile(alvo, 'utf8')
    } catch {
      continue
    }
    if (!achatar(texto).includes(alvoAchatado)) continue

    const linhas = texto.split('\n')
    for (let i = 0; i < linhas.length && achados.length < MAX_ACHADOS; i += 1) {
      if (achatar(linhas[i]).includes(alvoAchatado)) {
        achados.push(`${relativo}:${i + 1}: ${linhas[i].trim().slice(0, 160)}`)
      }
    }
  }

  if (!achados.length) {
    // Dizer so "nao achei" faz ele desistir. Dizer o que tentar faz ele tentar.
    return (
      `(nao achei "${termo}" em lugar nenhum do ${repo} — ja procurei ignorando ` +
      'maiuscula e acento)\n' +
      'TENTE AINDA: uma palavra mais curta ou um pedaco dela; o texto como ' +
      'aparece na TELA para o usuario; o nome em ingles e em portugues; ou ' +
      '"listar" a pasta para ver os arquivos. Só desista depois de tentar isso.'
    )
  }
  return achados.join('\n')
}

/** Le uma janela de linhas. Sem janela, arquivo grande vem cortado. */
export async function ler(repo, caminho, linha, quantas) {
  const veredito = podeMexer(repo, caminho)
  if (!veredito.permitido) return `(nao posso ler: ${veredito.motivo})`

  const alvo = dentroDoRepo(repo, caminho)
  if (!alvo) return '(esse caminho sai da pasta do projeto)'

  let texto = ''
  try {
    texto = await fs.readFile(alvo, 'utf8')
  } catch {
    return '(esse arquivo nao existe)'
  }

  const linhas = texto.split('\n')

  if (!Number.isFinite(linha)) {
    if (texto.length <= ARQUIVO_PEQUENO) {
      return linhas.map((l, i) => `${i + 1}: ${l}`).join('\n')
    }
    return (
      `(este arquivo tem ${linhas.length} linhas e ${texto.length} caracteres — ` +
      'grande demais para ler inteiro. Use "buscar" para achar a linha e volte ' +
      'aqui dizendo a linha inicial.)'
    )
  }

  const de = Math.max(1, Math.floor(linha) - 1)
  const quantasLinhas = Math.min(Math.max(1, Math.floor(quantas) || JANELA_PADRAO), 400)
  return linhas
    .slice(de, de + quantasLinhas)
    .map((l, i) => `${de + i + 1}: ${l}`)
    .join('\n')
}

export async function listar(repo, pasta = '') {
  const alvo = dentroDoRepo(repo, pasta)
  if (!alvo) return '(caminho invalido)'
  try {
    const itens = await fs.readdir(alvo, { withFileTypes: true })
    return itens
      .filter((i) => i.name !== '.git' && i.name !== 'node_modules')
      .map((i) => (i.isDirectory() ? `${i.name}/` : i.name))
      .join('\n')
  } catch {
    return '(essa pasta nao existe)'
  }
}

/**
 * Confere as ancoras contra os arquivos de verdade.
 *
 * Feito AQUI, e nao so na oficina, para o Zeus poder corrigir sozinho na volta
 * seguinte: ancora errada e o erro mais comum, e falhar no fim do trabalho
 * desperdicaria tudo que ele leu ate aqui.
 */
async function conferirAncoras(repo, arquivos) {
  const problemas = []
  for (const a of arquivos) {
    if (typeof a.procurar !== 'string') continue
    const alvo = dentroDoRepo(repo, a.caminho)
    if (!alvo) {
      problemas.push(`${a.caminho}: caminho invalido`)
      continue
    }
    let texto = ''
    try {
      texto = await fs.readFile(alvo, 'utf8')
    } catch {
      problemas.push(`${a.caminho}: esse arquivo nao existe`)
      continue
    }
    const r = aplicarTroca(texto, a)
    if (!r.ok) problemas.push(`${a.caminho}: ${r.erro}`)
  }
  return problemas
}

/** Recebe a ordem falada e devolve a proposta pronta, ou o motivo de nao dar. */
export async function montarProposta({ repo, ordem }) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { ok: false, erros: ['sem chave da Anthropic'] }
  if (!REPOS_PERMITIDOS.includes(repo)) {
    return { ok: false, erros: ['esse repositorio nao e meu'] }
  }

  const comecou = Date.now()
  const messages = [{ role: 'user', content: `Ordem do Paulo: ${ordem}` }]

  for (let volta = 0; volta < MAX_VOLTAS; volta += 1) {
    const gasto = Date.now() - comecou
    if (gasto > PRAZO) {
      const min = Math.round(gasto / 60000)
      console.warn(`[zeus] desisti de "${ordem}" depois de ${min} min`)
      return {
        ok: false,
        erros: [
          `passei ${min} minutos nisso e nao cheguei na alteracao. ` +
            'Me diga de novo com mais detalhe de onde mexer, ou faca na mao',
        ],
      }
    }

    // TIMEOUT POR VOLTA — 18/09/2026, segunda rodada.
    //
    // Sem ele, uma chamada travada deixa a tarefa em "trabalhando" para
    // sempre: ela nunca entra na fila do que ele tem para contar, e o Paulo
    // fica esperando um aviso que nao vem. Silencio para sempre e pior que
    // "nao deu" — pelo menos "nao deu" ele pode mandar tentar de novo.
    const ctrl = new AbortController()
    const relogio = setTimeout(() => {
      try {
        ctrl.abort()
      } catch {
        /* ja abortado */
      }
    }, TIMEOUT_VOLTA)

    let resp
    try {
      resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: MODELO,
          // Cabe folgado numa troca de trecho. Era 16000 quando ele tentava
          // devolver o arquivo inteiro — e nem assim cabia.
          max_tokens: 8000,
          system: instrucao(repo),
          tools: FERRAMENTAS,
          messages,
          // ESFORCO MAXIMO PRATICO, DE PROPOSITO.
          //
          // Aqui nao se economiza. Ler codigo alheio e montar uma alteracao
          // que encaixa de primeira e exatamente o trabalho que paga esforco
          // alto — e cada volta que ele economiza pensando vira tres voltas
          // errando a ancora, que custam mais tempo e mais dinheiro que o
          // esforco teria custado.
          //
          // `xhigh` e o nivel recomendado para trabalho de codigo. O padrao
          // seria `high`. A conversa continua no rapido, onde o que vale e
          // responder logo.
          output_config: { effort: 'xhigh' },
        }),
      })
    } catch (e) {
      const travou = e?.name === 'AbortError'
      return {
        ok: false,
        erros: [travou ? 'a IA travou e eu cortei a espera' : `nao alcancei a IA: ${e?.message || e}`],
      }
    } finally {
      clearTimeout(relogio)
    }

    if (!resp.ok) {
      const detalhe = await resp.text().catch(() => '')
      return { ok: false, erros: [`a IA recusou: ${detalhe.slice(0, 150)}`] }
    }

    const dados = await resp.json()
    messages.push({ role: 'assistant', content: dados.content })

    const chamadas = (dados.content || []).filter((b) => b.type === 'tool_use')
    // Sem este registro, "ele travou" e adivinhacao. Com ele da para ver se o
    // Zeus se perdeu procurando, lendo, ou tentando encaixar a troca.
    console.log(
      `[zeus] trabalho "${ordem.slice(0, 40)}" volta ${volta + 1}: ` +
        `${chamadas.map((c) => c.name).join(', ') || 'nenhuma ferramenta'} ` +
        `(${Math.round((Date.now() - comecou) / 1000)}s ate aqui)`
    )
    if (chamadas.length === 0) {
      const texto = (dados.content || []).find((b) => b.type === 'text')?.text
      return { ok: false, erros: [texto || 'nao consegui montar a alteracao'] }
    }

    // PERGUNTAR VALE MAIS QUE DESISTIR.
    //
    // 18/09/2026: ele nao achou a newsletter, concluiu que ela nao existia e
    // parou. Nao existia porque ele estava procurando no repositorio errado —
    // mas mesmo certo, "nao achei" devolvido como falha faz o Paulo pedir tudo
    // de novo, do zero, adivinhando o que deu errado.
    //
    // Uma pergunta custa uma frase e resolve. Ela sai pela mesma boca do aviso
    // de tarefa pronta, entao o Paulo OUVE sem precisar perguntar nada.
    const duvida = chamadas.find((c) => c.name === 'perguntar')
    if (duvida) {
      const texto = String(duvida.input?.pergunta || '').trim()
      if (texto) {
        console.log(`[zeus] trabalho "${ordem.slice(0, 40)}" virou pergunta: ${texto}`)
        return { ok: false, pergunta: texto, erros: [texto] }
      }
    }

    const entrega = chamadas.find((c) => c.name === 'propor')
    if (entrega) {
      const proposta = {
        repo,
        ramo: nomearRamo(entrega.input?.titulo || ordem),
        titulo: entrega.input?.titulo,
        resumo: entrega.input?.resumo,
        arquivos: entrega.input?.arquivos || [],
      }

      const conferencia = validar(proposta)
      const problemas = conferencia.ok
        ? await conferirAncoras(repo, proposta.arquivos)
        : conferencia.erros

      if (!problemas.length) {
        console.log(
          `[zeus] trabalho pronto em ${((Date.now() - comecou) / 1000).toFixed(0)}s, ` +
            `${volta + 1} idas e vindas`
        )
        return { ok: true, proposta }
      }

      // Devolve o problema para ele corrigir na volta seguinte, em vez de
      // desistir: ancora errada e o erro mais comum, e desistir aqui jogaria
      // fora tudo que ele leu.
      messages.push({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: entrega.id,
            content: `Nao deu para aplicar: ${problemas.join('; ')}. Confira o arquivo e tente de novo com um trecho maior e exato.`,
            is_error: true,
          },
        ],
      })
      continue
    }

    // Todas as leituras da rodada voltam JUNTAS, numa mensagem so: separar
    // ensina o modelo a parar de pedir varias coisas de uma vez, e ai cada
    // arquivo vira uma ida e volta paga.
    const resultados = []
    for (const c of chamadas) {
      let saida = '(nao conheco essa ferramenta)'
      if (c.name === 'buscar') saida = await buscar(repo, c.input?.termo || '')
      else if (c.name === 'ler') {
        saida = await ler(repo, c.input?.caminho || '', c.input?.linha, c.input?.quantas)
      } else if (c.name === 'listar') saida = await listar(repo, c.input?.pasta || '')
      resultados.push({ type: 'tool_result', tool_use_id: c.id, content: saida })
    }
    messages.push({ role: 'user', content: resultados })
  }

  return { ok: false, erros: ['me perdi no codigo e parei antes de gastar mais'] }
}
