import test from 'node:test'
import assert from 'node:assert/strict'
import { DOLARES_POR_BUSCA, cotacao, emDolares, emReais, precoDe } from './precos.js'

// ---------------------------------------------------------------------------
// O CUSTO APARECE EM REAIS — decisao do Paulo, 18/09/2026
// ---------------------------------------------------------------------------

test('um milhao de tokens de entrada custa o preco da tabela', () => {
  const d = emDolares({ modelo: 'claude-haiku-4-5', entrada: 1_000_000 })
  assert.equal(d, 1)
})

test('o modelo forte custa mais que o rapido, e a conta mostra isso', () => {
  const rapido = emDolares({ modelo: 'claude-haiku-4-5', entrada: 1000, saida: 1000 })
  const forte = emDolares({ modelo: 'claude-opus-5', entrada: 1000, saida: 1000 })
  assert.ok(forte > rapido * 4)
})

test('o cache custa uma fracao da entrada — e por isso que ele existe', () => {
  const novo = emDolares({ modelo: 'claude-opus-5', entrada: 100_000 })
  const repetido = emDolares({ modelo: 'claude-opus-5', cache: 100_000 })
  assert.ok(repetido < novo / 5)
})

test('a busca na internet entra na conta mesmo sem token nenhum', () => {
  const d = emDolares({ modelo: 'claude-opus-5', buscas: 3 })
  assert.equal(d, 3 * DOLARES_POR_BUSCA)
})

// A REGRA QUE IMPORTA MAIS QUE TODAS AS OUTRAS AQUI.
//
// Modelo fora da tabela nao ganha preco chutado. O painel mostra "nao sei", e
// "nao sei" e a resposta honesta — numero inventado num painel de custo faria
// o Paulo decidir dinheiro em cima de invencao.
test('modelo desconhecido nao ganha preco inventado: devolve nao sei', () => {
  assert.equal(precoDe('claude-modelo-que-ainda-nao-existe'), null)
  assert.equal(emDolares({ modelo: 'claude-modelo-que-ainda-nao-existe', saida: 9999 }), null)
  assert.equal(emReais({ modelo: 'inventado', entrada: 1_000_000 }), null)
})

test('nao sei nunca vira zero', () => {
  assert.notEqual(emDolares({ modelo: 'inventado', entrada: 10 }), 0)
})

test('a cotacao do dolar sai do zeus.env, e valor bobo nao passa', () => {
  const antes = process.env.ZEUS_DOLAR
  try {
    process.env.ZEUS_DOLAR = '6'
    assert.equal(cotacao(), 6)
    process.env.ZEUS_DOLAR = '0'
    assert.ok(cotacao() > 1, 'dolar zero zeraria a conta inteira em silencio')
    process.env.ZEUS_DOLAR = 'nao e numero'
    assert.ok(cotacao() > 1)
  } finally {
    if (antes === undefined) delete process.env.ZEUS_DOLAR
    else process.env.ZEUS_DOLAR = antes
  }
})
