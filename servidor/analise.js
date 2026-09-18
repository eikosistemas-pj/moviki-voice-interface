// servidor/analise.js  (repo: moviki-voice-interface)
//
// O ZEUS OLHANDO O CODIGO E RESPONDENDO — sem abrir Pull Request nenhum.
//
// ---------------------------------------------------------------------------
// O BURACO QUE ESTE ARQUIVO FECHA — 18/09/2026
// ---------------------------------------------------------------------------
// O Paulo pediu "analise o painel do parceiro" e nao aconteceu NADA. Pior:
// o Zeus disse que estava analisando, por uma hora, sem ter comecado.
//
// O motivo era de desenho. Existiam dois caminhos e so dois:
//
//   ordem com verbo de mudanca  -> trabalho -> le o codigo -> Pull Request
//   qualquer outra coisa        -> conversa -> responde SEM VER O CODIGO
//
// "Analisar" nao e verbo de mudanca, entao caia na conversa. E na conversa ele
// so tem o retrato (que ramo, que commits) — nao tem o codigo. Ele tinha olhos
// para ler, mas os olhos so abriam dentro do caminho que termina em Pull
// Request.
//
// Entao perguntar "o que tem de errado no painel?" era a unica coisa que ele
// nao conseguia fazer: a mais barata, a mais segura, e a que o Paulo mais
// pede.
//
// AQUI E TUDO LEITURA. NAO EXISTE FERRAMENTA DE ESCREVER.
// As mesmas tres ferramentas do trabalho (buscar, ler, listar), obedecendo as
// mesmas cercas de servidor/maos.js — ele nao le o que nao poderia alterar,
// porque ler segredo nao seria alteracao, seria vazamento. O que muda e a
// saida: em vez de "propor", ele tem "responder".
//
// POR QUE CORRE POR FORA DA CONVERSA
// Ler codigo leva dezenas de segundos e o Paulo esta na frente da tela
// esperando uma voz. Ele ouve "vou olhar" na hora, e a resposta chega sozinha
// quando ficar pronta — a tela pergunta de doze em doze segundos.
//
// PRAZO CURTO, DE PROPOSITO
// Analise e para ser rapida. Se em cinco minutos ele nao formou uma resposta,
// a resposta que ele daria nao presta. Melhor dizer "nao consegui" do que
// deixar o Paulo esperando — foi exatamente esse o vexame de hoje.

import { buscar, ler, listar } from './trabalho.js'
import { REPOS_PERMITIDOS } from './maos.js'

const MODELO = process.env.ZEUS_MODELO_ANALISE || 'claude-opus-5'

/** Analise e leitura, nao construcao: menos voltas que o trabalho. */
const MAX_VOLTAS = Number(process.env.ZEUS_VOLTAS_ANALISE || 10)

/** Prazo curto: analise que demora nao serve para quem esta esperando falando. */
const PRAZO = Number(process.env.ZEUS_PRAZO_ANALISE || 5 * 60 * 1000)

const TIMEOUT_VOLTA = Number(process.env.ZEUS_TIMEOUT_ANALISE || 90_000)

/** Ele fala a resposta. Voz longa cansa, entao o teto e baixo. */
const MAX_TOKENS = 2000

const FERRAMENTAS = [
  {
    name: 'buscar',
    description:
      'Acha um texto no repositorio inteiro e devolve arquivo e linha de cada ocorrencia. COMECE SEMPRE POR AQUI: e o jeito de se localizar sem carregar arquivos gigantes.',
    input_schema: {
      type: 'object',
      properties: { termo: { type: 'string', description: 'texto a procurar, sem curingas' } },
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
    description: 'Lista os arquivos de uma pasta do repositorio. Bom para comecar quando voce nao sabe onde procurar.',
    input_schema: {
      type: 'object',
      properties: { pasta: { type: 'string' } },
      required: [],
    },
  },
  {
    name: 'responder',
    description:
      'Entrega a resposta ao Paulo. Use assim que voce souber o suficiente para responder — nao fique lendo mais do que precisa.',
    input_schema: {
      type: 'object',
      properties: {
        resposta: {
          type: 'string',
          description:
            'O que voce vai FALAR para ele. Duas a quatro frases, em linguagem de negocio, sem codigo e sem caminho de arquivo soletrado.',
        },
        achados: {
          type: 'array',
          description:
            'Opcional: problemas concretos que voce viu, um por item, curtos. Isso fica escrito, nao e falado.',
          items: { type: 'string' },
        },
        vale_acordar: {
          type: 'boolean',
          description:
            'So quando NINGUEM perguntou e voce foi olhar por conta propria: true apenas se o Paulo precisa AGIR sobre isso. Curiosidade, elogio e observacao geral sao false.',
        },
      },
      required: ['resposta'],
    },
  },
]

function instrucao(repo, pergunta) {
  return `Voce e o ZEUS olhando o repositorio ${repo} do MOVIKI, a pedido do Paulo.

O QUE ELE QUER SABER
${pergunta}

COMO OLHAR — NESTA ORDEM
1. "listar" se voce nao sabe onde fica o assunto.
2. "buscar" o texto que tem a ver com o que ele perguntou.
3. "ler" a janela em volta dos achados.
4. "responder" assim que souber o suficiente.

VOCE NAO ESTA ALTERANDO NADA. Nao existe ferramenta de escrever aqui. Se a
resposta certa for "isso precisa mudar", diga isso na resposta e pare — quem
manda mexer e o Paulo, e ele vai pedir com todas as letras.

OS ARQUIVOS AQUI SAO ENORMES. O index.html do painel tem mais de meio milhao
de caracteres. NUNCA tente ler um arquivo desses inteiro: busque, e leia a
janela em volta do achado.

PARE CEDO. Voce tem poucos minutos e o Paulo esta esperando ouvir a resposta.
Assim que der para responder com honestidade, responda. Ler mais do que o
necessario nao melhora a resposta — atrasa ela.

COMO RESPONDER
- Voce vai ser OUVIDO, nao lido. Duas a quatro frases, sem lista, sem markdown,
  sem nome de arquivo soletrado, sem codigo.
- Linguagem de negocio: o que isso significa para o lojista, para o parceiro,
  para ele.
- COMECE PELA CONCLUSAO, nao pelo caminho que voce percorreu.
- Se voce nao achou o que ele perguntou, DIGA QUE NAO ACHOU e diga onde
  procurou. Nunca invente um achado para parecer util: um problema inventado
  faz ele gastar a tarde atras de coisa que nao existe.
- Se voce achou problema de verdade, diga o mais grave primeiro.`
}

/**
 * Le o codigo e devolve a resposta falada.
 *
 * Devolve `{ ok, resposta, achados }` ou `{ ok: false, erros }`. Nunca lanca:
 * quem chama precisa conseguir contar ao Paulo que nao deu.
 */
/**
 * A instrucao de quando NINGUEM PERGUNTOU — ele foi olhar sozinho.
 *
 * Aqui a regra se inverte. Na analise pedida, ficar calado seria nao atender.
 * Na patrulha, FALAR A TOA e o erro caro: assistente que interrompe o dono com
 * observacao sem importancia e desligado na primeira semana — e ai nao avisa
 * nem o que importava.
 *
 * Entao o padrao e o silencio, e a barra para abrir a boca e alta.
 */
function instrucaoDePatrulha(repo) {
  return `Voce e o ZEUS, e NINGUEM TE PEDIU NADA. Voce foi olhar o repositorio
${repo} do MOVIKI por conta propria, procurando problema.

O QUE VOCE PROCURA, nesta ordem de importancia
1. Coisa QUEBRADA: erro que derruba a pagina, funcao chamada que nao existe,
   link ou caminho que aponta para o nada, valor que nunca foi preenchido.
2. Coisa que engana o LOJISTA ou o PARCEIRO: texto errado, preco que nao bate
   com o plano, botao que promete o que nao faz.
3. Coisa deixada pela metade: "TODO", trecho comentado no lugar do que devia
   funcionar, aviso de erro que nunca aparece para ninguem.

VOCE NAO VAI MEXER EM NADA. Nao existe ferramenta de escrever aqui. Se achar
algo, voce CONTA. Quem manda arrumar e o Paulo.

A REGRA MAIS IMPORTANTE: O PADRAO E FICAR CALADO.
O Paulo esta trabalhando. Interromper ele custa caro. Marque "vale_acordar"
como true SO se as tres coisas forem verdade ao mesmo tempo:
  - e um problema DE VERDADE, que voce viu no codigo, nao uma suspeita;
  - ele atrapalha alguem de verdade (lojista, parceiro ou o proprio Paulo);
  - o Paulo precisa DECIDIR ou MANDAR fazer alguma coisa sobre isso.

Estilo de codigo, preferencia sua, "daria para melhorar", "seria bom
documentar" — nada disso vale acordar ninguem. Marque false e siga.

NUNCA INVENTE UM PROBLEMA PARA PARECER UTIL. Se voce olhou e esta tudo bem,
responda "nada digno de nota" com vale_acordar false. Isso e uma resposta
otima, nao um fracasso — problema inventado faz o Paulo gastar a tarde atras
de coisa que nao existe, e na terceira vez ele te desliga.

OS ARQUIVOS SAO ENORMES: busque e leia janelas, nunca arquivo inteiro.
PARE CEDO. Uma rodada de patrulha e uma olhada, nao uma auditoria.

Se achar algo que vale: uma frase, comecando por "Paulo,", dizendo o que esta
errado e o que isso causa. Sem codigo, sem nome de arquivo soletrado.`
}

export async function analisar({ repo, pergunta, patrulha = false }) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { ok: false, erros: ['sem chave da Anthropic'] }
  if (!REPOS_PERMITIDOS.includes(repo)) {
    return { ok: false, erros: ['esse repositorio nao e meu'] }
  }

  const comecou = Date.now()
  const messages = [{ role: 'user', content: `Pergunta do Paulo: ${pergunta}` }]

  for (let volta = 0; volta < MAX_VOLTAS; volta += 1) {
    const gasto = Date.now() - comecou
    if (gasto > PRAZO) {
      const min = Math.round(gasto / 60000)
      return {
        ok: false,
        erros: [`olhei por ${min} minutos e nao fechei uma resposta. Me pergunte de um jeito mais especifico`],
      }
    }

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
          max_tokens: MAX_TOKENS,
          system: patrulha ? instrucaoDePatrulha(repo) : instrucao(repo, pergunta),
          tools: FERRAMENTAS,
          messages,
          // Ler codigo alheio e responder sem chutar paga esforco. Nao e
          // `xhigh` como o trabalho: aqui ele so precisa entender, nao montar
          // uma alteracao que encaixa de primeira — e o Paulo esta esperando.
          output_config: { effort: 'high' },
        }),
      })
    } catch (e) {
      clearTimeout(relogio)
      const travou = e?.name === 'AbortError'
      return {
        ok: false,
        erros: [travou ? 'travei olhando e cortei a espera' : `nao alcancei a IA: ${e?.message || e}`],
      }
    }
    clearTimeout(relogio)

    if (!resp.ok) {
      const detalhe = await resp.text().catch(() => '')
      return { ok: false, erros: [`a IA recusou: ${String(detalhe).slice(0, 150)}`] }
    }

    const dados = await resp.json()
    messages.push({ role: 'assistant', content: dados.content })

    const chamadas = (dados.content || []).filter((b) => b.type === 'tool_use')
    console.log(
      `[zeus] analise "${pergunta.slice(0, 40)}" volta ${volta + 1}: ` +
        `${chamadas.map((c) => c.name).join(', ') || 'nenhuma ferramenta'} ` +
        `(${Math.round((Date.now() - comecou) / 1000)}s ate aqui)`
    )

    if (chamadas.length === 0) {
      // Respondeu em texto solto em vez de usar a ferramenta. Vale: o que ele
      // escreveu E a resposta, e recusar aqui seria perder o trabalho todo por
      // formalidade.
      const texto = (dados.content || []).find((b) => b.type === 'text')?.text
      if (texto?.trim()) {
        return { ok: true, resposta: texto.trim(), achados: [] }
      }
      return { ok: false, erros: ['olhei e nao consegui formar uma resposta'] }
    }

    const entrega = chamadas.find((c) => c.name === 'responder')
    if (entrega) {
      const resposta = String(entrega.input?.resposta || '').trim()
      if (!resposta) return { ok: false, erros: ['olhei e nao consegui formar uma resposta'] }
      console.log(
        `[zeus] analise pronta em ${Math.round((Date.now() - comecou) / 1000)}s, ` +
          `${volta + 1} idas e vindas`
      )
      return {
        ok: true,
        resposta,
        achados: Array.isArray(entrega.input?.achados) ? entrega.input.achados : [],
        valeAcordar: entrega.input?.vale_acordar === true,
      }
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

  return { ok: false, erros: ['olhei bastante e nao fechei uma resposta. Me pergunte de um jeito mais especifico'] }
}
