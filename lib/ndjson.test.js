import test from 'node:test'
import assert from 'node:assert/strict'
import { lerLinhas } from './ndjson.js'

/** Simula a rede entregando os bytes em pedacos torto, que e como ela entrega. */
function corpoDe(pedacos) {
  const cod = new TextEncoder()
  return new ReadableStream({
    start(controlador) {
      for (const p of pedacos) controlador.enqueue(cod.encode(p))
      controlador.close()
    },
  })
}

async function juntar(corpo) {
  const linhas = []
  for await (const l of lerLinhas(corpo)) linhas.push(l)
  return linhas
}

test('junta uma linha partida entre dois pedacos da rede', async () => {
  // Pedaco da rede quase nunca termina no fim da linha. Entregar meia linha
  // faria o JSON.parse falhar e o Zeus perder a frase.
  const linhas = await juntar(
    corpoDe(['{"t":"fala","texto":"Assu', 'mi o posto."}\n{"t":"fim"}\n'])
  )
  assert.deepEqual(linhas, ['{"t":"fala","texto":"Assumi o posto."}', '{"t":"fim"}'])
  assert.equal(JSON.parse(linhas[0]).texto, 'Assumi o posto.')
})

test('varias linhas no mesmo pedaco saem separadas', async () => {
  const linhas = await juntar(corpoDe(['{"a":1}\n{"a":2}\n{"a":3}\n']))
  assert.equal(linhas.length, 3)
})

test('ultima linha sem quebra no fim nao se perde', async () => {
  const linhas = await juntar(corpoDe(['{"t":"fim"}']))
  assert.deepEqual(linhas, ['{"t":"fim"}'])
})

test('linha em branco nao vira linha', async () => {
  const linhas = await juntar(corpoDe(['{"a":1}\n\n\n{"a":2}\n']))
  assert.equal(linhas.length, 2)
})

test('corpo ausente nao quebra a tela', async () => {
  assert.deepEqual(await juntar(null), [])
  assert.deepEqual(await juntar(undefined), [])
})
