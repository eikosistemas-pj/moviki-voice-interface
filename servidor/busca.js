// servidor/busca.js  (repo: moviki-voice-interface)
//
// O ZEUS OLHANDO PARA FORA — pesquisa na internet.
//
// ---------------------------------------------------------------------------
// O PEDIDO DO PAULO — 18/09/2026
// ---------------------------------------------------------------------------
// "Voce precisa dar a ele informacoes para que ele pesquise na internet
// tambem, para ficar mais inteligente."
//
// Ate agora o Zeus so enxergava PARA DENTRO: o mapa mestre, o retrato dos
// repositorios, o codigo. Tudo o que estava fora disso ele nao sabia — e, pior,
// respondia com o que aprendeu no treino, que tem data de validade.
//
// Pergunta de preco de concorrente, mudanca de regra de plataforma, novidade de
// servico que o Moviki usa: nada disso mora no codigo.
//
// ---------------------------------------------------------------------------
// A BUSCA RODA DO LADO DA ANTHROPIC, NAO NESTA MAQUINA
// ---------------------------------------------------------------------------
// E ferramenta de servidor: quem procura e executa e a Anthropic, e o resultado
// volta dentro da mesma resposta. A VPS de 2 GB nao baixa pagina, nao guarda
// nada e nao ganha porta nova para fora. Numa maquina que ja passou aperto de
// memoria, isso nao e detalhe.
//
// ---------------------------------------------------------------------------
// OS FREIOS
// ---------------------------------------------------------------------------
// Cada busca e paga. `MAX_BUSCAS` limita quantas ele faz por pergunta — sem
// isso uma pergunta vaga viraria dez buscas atras de uma resposta que nao
// existe.
//
// E ele continua proibido de acreditar em tudo: a instrucao manda dizer DE ONDE
// veio o que ele falou. Numero solto, sem fonte, dito com voz de comando, vira
// decisao errada do Paulo — que e o mesmo estrago de um problema inventado.

const MODELO = process.env.ZEUS_MODELO_BUSCA || 'claude-opus-5'

/** Quantas buscas por pergunta. Cada uma e paga. */
const MAX_BUSCAS = Number(process.env.ZEUS_MAX_BUSCAS || 5)

/** Quantas idas e vindas ate ele fechar a resposta. */
const MAX_VOLTAS = Number(process.env.ZEUS_VOLTAS_BUSCA || 6)

const PRAZO = Number(process.env.ZEUS_PRAZO_BUSCA || 3 * 60 * 1000)
const TIMEOUT_VOLTA = Number(process.env.ZEUS_TIMEOUT_BUSCA || 90_000)
const MAX_TOKENS = 2000

/**
 * A ferramenta de busca muda de nome conforme o modelo.
 *
 * Os modelos novos tem a versao com filtragem; os antigos, so a basica. Mandar
 * a versao errada faz a API recusar o pedido inteiro — e o Zeus fica sem
 * resposta nenhuma, que e o mesmo defeito que o `effort` no Haiku causou.
 */
export function ferramentaDeBusca(modelo) {
  const m = String(modelo || '')
  if (/^claude-(opus|sonnet|fable|mythos)-[5-9]/.test(m) || /^claude-opus-4-[6-9]/.test(m)) {
    return { type: 'web_search_20260209', name: 'web_search', max_uses: MAX_BUSCAS }
  }
  return { type: 'web_search_20250305', name: 'web_search', max_uses: MAX_BUSCAS }
}

function instrucao(pergunta) {
  return `Voce e o ZEUS, assistente de comando do Paulo, dono do MOVIKI — um SaaS
para negocios itinerantes (food truck, feira, loja movel).

O PAULO PERGUNTOU
${pergunta}

Isto e coisa de FORA: nao esta no codigo dele nem no mapa do projeto. Procure na
internet e responda.

COMO PROCURAR
- Pouca busca e boa busca. Procure o que resolve a pergunta e pare.
- Se a resposta depender de quando e (preco, regra, versao), procure o valor de
  AGORA e diga a data do que voce achou.

COMO RESPONDER
- Voce vai ser OUVIDO, nao lido. DUAS A QUATRO FRASES, sem lista, sem markdown,
  sem endereco de site soletrado.
- COMECE PELA RESPOSTA. O caminho que voce percorreu nao interessa.
- DIGA DE ONDE VEIO. Uma mencao curta basta ("segundo o site da propria
  Hetzner", "pelo que o Google publicou em julho"). Numero solto, sem fonte,
  dito com voz de comando, vira decisao errada do Paulo.
- Se as fontes discordarem, diga que discordam. Fingir certeza e pior que
  admitir duvida.
- Se voce NAO achou, diga que nao achou. Nunca preencha o buraco com o que voce
  acha que sabe: o que voce aprendeu no treino tem data de validade, e ele nao
  tem como saber qual parte esta velha.
- Ligue a resposta ao negocio dele quando fizer sentido: o que isso muda para o
  Moviki, para o lojista, para o bolso dele.`
}

const RESPONDER = {
  name: 'responder',
  description: 'Entrega a resposta ao Paulo. Use assim que souber o suficiente.',
  input_schema: {
    type: 'object',
    properties: {
      resposta: {
        type: 'string',
        description:
          'O que voce vai FALAR. Duas a quatro frases, com a fonte mencionada de leve.',
      },
    },
    required: ['resposta'],
  },
}

/**
 * Pesquisa e devolve a resposta falada.
 *
 * Devolve `{ ok, resposta }` ou `{ ok: false, erros }`. Nunca lanca.
 */
export async function pesquisar({ pergunta }) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { ok: false, erros: ['sem chave da Anthropic'] }

  const comecou = Date.now()
  const messages = [{ role: 'user', content: String(pergunta || '') }]

  for (let volta = 0; volta < MAX_VOLTAS; volta += 1) {
    if (Date.now() - comecou > PRAZO) {
      return { ok: false, erros: ['procurei e nao fechei uma resposta a tempo'] }
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
          system: instrucao(pergunta),
          tools: [ferramentaDeBusca(MODELO), RESPONDER],
          messages,
        }),
      })
    } catch (e) {
      clearTimeout(relogio)
      const travou = e?.name === 'AbortError'
      return {
        ok: false,
        erros: [travou ? 'travei procurando e cortei a espera' : `nao alcancei a IA: ${e?.message || e}`],
      }
    }
    clearTimeout(relogio)

    if (!resp.ok) {
      const detalhe = await resp.text().catch(() => '')
      return { ok: false, erros: [`a IA recusou: ${String(detalhe).slice(0, 150)}`] }
    }

    const dados = await resp.json()
    messages.push({ role: 'assistant', content: dados.content })

    const quantasBuscas = (dados.content || []).filter(
      (b) => b.type === 'server_tool_use' || b.type === 'web_search_tool_result'
    ).length
    console.log(
      `[zeus] busca "${String(pergunta).slice(0, 40)}" volta ${volta + 1}: ` +
        `${quantasBuscas} bloco(s) de pesquisa, parou por "${dados.stop_reason}" ` +
        `(${Math.round((Date.now() - comecou) / 1000)}s)`
    )

    // PAUSA NO MEIO DA BUSCA. Nao e erro: a API interrompe para a busca seguir
    // na volta seguinte. Continuar SEM acrescentar mensagem nenhuma e o jeito
    // certo — mandar texto aqui atrapalharia o que ele estava fazendo.
    if (dados.stop_reason === 'pause_turn') continue

    const entrega = (dados.content || []).find(
      (b) => b.type === 'tool_use' && b.name === 'responder'
    )
    if (entrega) {
      const resposta = String(entrega.input?.resposta || '').trim()
      if (resposta) return { ok: true, resposta }
    }

    // Respondeu em texto solto em vez de usar a ferramenta. Vale: o que ele
    // escreveu E a resposta, e recusar por formalidade jogaria fora a busca
    // inteira, que ja foi paga.
    const texto = (dados.content || [])
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join(' ')
      .trim()
    if (texto) return { ok: true, resposta: texto }

    if (dados.stop_reason === 'end_turn') {
      return { ok: false, erros: ['procurei e nao consegui formar uma resposta'] }
    }
  }

  return { ok: false, erros: ['procurei bastante e nao fechei uma resposta'] }
}
