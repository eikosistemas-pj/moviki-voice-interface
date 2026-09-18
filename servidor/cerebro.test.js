import test from 'node:test'
import assert from 'node:assert/strict'
import { aceitaEsforco, montarPedido, montarSystem } from './cerebro.js'

test('o Haiku nao recebe o parametro de esforco', () => {
  // ISTO ERA UM APAGAO, NAO UMA LENTIDAO. O `claude-haiku-4-5` recusa
  // `output_config.effort` com 400 — e o Zeus ficava sem resposta nenhuma,
  // dizendo que a ligacao com o cerebro falhou.
  assert.equal(aceitaEsforco('claude-haiku-4-5'), false)
  const pedido = montarPedido({
    modelo: 'claude-haiku-4-5',
    system: [],
    historico: [],
    falaNova: 'oi',
  })
  assert.equal(pedido.output_config, undefined)
})

test('modelo que aceita esforco continua recebendo', () => {
  assert.equal(aceitaEsforco('claude-opus-5'), true)
  assert.equal(aceitaEsforco('claude-sonnet-5'), true)
  const pedido = montarPedido({
    modelo: 'claude-opus-5',
    system: [],
    historico: [],
    falaNova: 'oi',
  })
  assert.deepEqual(pedido.output_config, { effort: 'low' })
})

test('modelo desconhecido nao recebe o parametro', () => {
  // Na duvida o parametro nao vai: deixar de mandar custa um pouco de
  // raciocinio; mandar errado custa a resposta inteira.
  assert.equal(aceitaEsforco('modelo-que-eu-nao-conheco'), false)
  assert.equal(aceitaEsforco(''), false)
  assert.equal(aceitaEsforco(undefined), false)
})

test('o pedido vai em fluxo', () => {
  // Sem `stream`, o servidor volta a segurar a resposta inteira antes de
  // deixar a voz comecar — que era metade da demora.
  const pedido = montarPedido({
    modelo: 'claude-haiku-4-5',
    system: [],
    historico: [],
    falaNova: 'oi',
  })
  assert.equal(pedido.stream, true)
})

test('o historico vira a conversa na ordem certa', () => {
  const pedido = montarPedido({
    modelo: 'claude-haiku-4-5',
    system: [],
    historico: [
      { papel: 'paulo', texto: 'como esta o painel' },
      { papel: 'zeus', texto: 'mudou essa semana' },
    ],
    falaNova: 'e o site',
  })
  assert.deepEqual(
    pedido.messages.map((m) => m.role),
    ['user', 'assistant', 'user']
  )
  assert.equal(pedido.messages[2].content, 'e o site')
})

test('os blocos vao do mais parado para o mais mexido', () => {
  // O desconto de cache so vale enquanto o COMECO do pedido nao muda nem um
  // byte. Se o retrato (que muda de 15 em 15 min) cair no mesmo bloco que o
  // mapa, um byte novo nele derruba o mapa inteiro e a conta dobra em silencio.
  const system = montarSystem({
    turnoAberto: false,
    mapa: 'MAPA MESTRE DO MOVIKI',
    retrato: 'retrato de agora',
    tarefas: [],
  })
  assert.equal(system.length, 3)

  // 1. persona + mapa: igual sempre, cache de uma hora.
  assert.ok(system[0].text.includes('MAPA MESTRE DO MOVIKI'))
  assert.deepEqual(system[0].cache_control, { type: 'ephemeral', ttl: '1h' })

  // 2. retrato: muda de 15 em 15 minutos, cache normal.
  assert.equal(system[1].text, 'retrato de agora')
  assert.deepEqual(system[1].cache_control, { type: 'ephemeral' })

  // 3. turno e tarefas: muda a cada fala, sem cache.
  assert.ok(system[2].text.includes('TURNO AGORA'))
  assert.equal(system[2].cache_control, undefined)
})

test('o cache de uma hora existe porque o Paulo fala de vez em quando', () => {
  // O desconto padrao vence em cinco minutos. O registro da VPS mostrou
  // conversas com "0 do cache" — cada uma releu treze mil tokens do zero, e
  // isso ele sente como a resposta demorando mais.
  const system = montarSystem({ turnoAberto: true, mapa: 'MAPA', retrato: 'r', tarefas: [] })
  assert.equal(system[0].cache_control.ttl, '1h')
})

test('sem retrato ele avisa que nao sabe, em vez de chutar', () => {
  const system = montarSystem({ turnoAberto: false, mapa: 'MAPA', retrato: null, tarefas: [] })
  assert.ok(system[1].text.includes('nao afirme nada sobre o estado do codigo'))
})

// ---------------------------------------------------------------------------
// O FLUXO DE VERDADE — com a API simulada
// ---------------------------------------------------------------------------
//
// Ler o formato de eventos da Anthropic e o tipo de coisa que quebra em
// silencio: o Zeus continuaria respondendo, so que mudo. Entao estes testes
// fingem a API e conferem o que sai.

import { pensarEmFluxo } from './cerebro.js'

/** Monta um corpo SSE igual ao que a Anthropic devolve, em pedacos torto. */
function respostaSSE(pedacos, extras = {}) {
  const eventos = [
    'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":12,"cache_read_input_tokens":6800}}}\n\n',
    ...pedacos.map(
      (p) =>
        `event: content_block_delta\ndata: ${JSON.stringify({
          type: 'content_block_delta',
          delta: { type: 'text_delta', text: p },
        })}\n\n`
    ),
    'event: message_delta\ndata: {"type":"message_delta","usage":{"output_tokens":41}}\n\n',
  ].join('')

  const cod = new TextEncoder()
  const bytes = cod.encode(eventos)
  return {
    ok: true,
    ...extras,
    // Entrega 17 bytes por vez para cortar eventos ao meio de proposito.
    body: new ReadableStream({
      start(c) {
        for (let i = 0; i < bytes.length; i += 17) c.enqueue(bytes.slice(i, i + 17))
        c.close()
      },
    }),
  }
}

async function comApiFalsa(resposta, corpo) {
  const antes = { fetch: globalThis.fetch, chave: process.env.ANTHROPIC_API_KEY }
  process.env.ANTHROPIC_API_KEY = 'chave-de-teste'
  let visto = null
  globalThis.fetch = async (_url, opcoes) => {
    visto = JSON.parse(opcoes.body)
    return resposta
  }
  try {
    return { r: await corpo(), visto }
  } finally {
    globalThis.fetch = antes.fetch
    if (antes.chave === undefined) delete process.env.ANTHROPIC_API_KEY
    else process.env.ANTHROPIC_API_KEY = antes.chave
  }
}

test('a primeira frase e entregue antes de a resposta acabar', async () => {
  const pedacos = []
  const resposta = respostaSSE([
    'Terminei o rodape.',
    ' Abri um Pull Request no painel do lojista',
    ' com o texto que voce pediu.',
    ' Me avise se quer que eu siga para o site publico.',
  ])

  const { r } = await comApiFalsa(resposta, () =>
    pensarEmFluxo({
      system: [],
      historico: [],
      falaNova: 'muda o rodape',
      aoPedaco: (p) => pedacos.push(p),
    })
  )

  assert.equal(r.ok, true)
  assert.ok(pedacos.length > 1, 'devia ter saido em mais de um pedaco')
  // Frase curta de verdade sai sozinha, na hora: e o pedaco que decide a
  // demora que o Paulo sente.
  assert.equal(pedacos[0], 'Terminei o rodape.')
  // Nada pode se perder no caminho entre a API e a voz.
  assert.equal(pedacos.join(' '), r.texto)
})

test('evento cortado no meio da rede nao perde texto', async () => {
  // Os pedacos de 17 bytes la em cima cortam os eventos no meio de proposito.
  const pedacos = []
  const { r } = await comApiFalsa(
    respostaSSE(['Assumi o posto. ', 'Vou tocando e presto contas quando voce chegar.']),
    () =>
      pensarEmFluxo({
        system: [],
        historico: [],
        falaNova: 'zeus assuma daqui',
        aoPedaco: (p) => pedacos.push(p),
      })
  )
  assert.equal(
    r.texto,
    'Assumi o posto. Vou tocando e presto contas quando voce chegar.'
  )
  assert.equal(pedacos.join(' '), r.texto)
})

test('API recusando nao lanca: o Zeus precisa poder dizer que falhou', async () => {
  const { r } = await comApiFalsa(
    { ok: false, status: 400, text: async () => 'output_config nao suportado' },
    () => pensarEmFluxo({ system: [], historico: [], falaNova: 'oi' })
  )
  assert.deepEqual(r, { ok: false, texto: '' })
})
