import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// O caderno mora onde ZEUS_GASTO mandar. Aqui mandamos para uma pasta
// descartavel: teste que escreve no caderno de verdade estragaria a conta.
const PASTA = fs.mkdtempSync(path.join(os.tmpdir(), 'zeus-gasto-'))
process.env.ZEUS_GASTO = path.join(PASTA, 'gasto.json')
process.env.ZEUS_DOLAR = '5'

const gasto = await import('./gasto.js')

function limpar() {
  try {
    fs.unlinkSync(process.env.ZEUS_GASTO)
  } catch {
    /* ja nao existia */
  }
}

// ---------------------------------------------------------------------------
// CADERNO AUSENTE E "NAO SEI", NAO "GASTEI ZERO"
// ---------------------------------------------------------------------------
//
// Sao coisas diferentes, e confundir as duas num painel de controle e o mesmo
// defeito do Zeus dizendo que esta trabalhando quando nao esta.

test('sem caderno nenhum, o resumo e nao sei', () => {
  limpar()
  assert.equal(gasto.resumo(), null)
})

test('a conversa entra na conta, em reais', () => {
  limpar()
  const agora = new Date('2026-09-18T10:00:00Z')
  // 1 milhao de tokens de entrada no Haiku = 1 dolar = 5 reais na cotacao fixada.
  gasto.anotar({ tipo: 'conversa', modelo: 'claude-haiku-4-5', entrada: 1_000_000 }, agora)
  const r = gasto.resumo(agora)
  assert.equal(r.hoje.reais, 5)
  assert.equal(r.hoje.chamadas, 1)
  assert.equal(r.hoje.completo, true)
  assert.equal(r.porTipo.conversa, 5)
})

test('soma as chamadas do dia e separa o mes', () => {
  limpar()
  const agora = new Date('2026-09-18T10:00:00Z')
  gasto.anotar({ tipo: 'conversa', modelo: 'claude-haiku-4-5', entrada: 1_000_000 }, agora)
  gasto.anotar({ tipo: 'trabalho', modelo: 'claude-opus-5', entrada: 1_000_000 }, agora)
  const r = gasto.resumo(agora)
  assert.equal(r.hoje.reais, 30) // 5 + 25
  assert.equal(r.hoje.chamadas, 2)
  assert.equal(r.mes.reais, 30)
})

test('vira a pagina no dia seguinte, e o mes continua contando', () => {
  limpar()
  gasto.anotar(
    { tipo: 'conversa', modelo: 'claude-haiku-4-5', entrada: 1_000_000 },
    new Date('2026-09-18T23:00:00Z')
  )
  gasto.anotar(
    { tipo: 'conversa', modelo: 'claude-haiku-4-5', entrada: 1_000_000 },
    new Date('2026-09-19T01:00:00Z')
  )
  const r = gasto.resumo(new Date('2026-09-19T02:00:00Z'))
  assert.equal(r.hoje.reais, 5, 'o dia recomeca do zero')
  assert.equal(r.mes.reais, 10, 'o mes nao recomeca junto')
})

test('o resumo de hoje nao herda o gasto de ontem', () => {
  limpar()
  gasto.anotar(
    { tipo: 'conversa', modelo: 'claude-haiku-4-5', entrada: 1_000_000 },
    new Date('2026-09-18T10:00:00Z')
  )
  // Ninguem gastou nada hoje ainda, e o caderno so tem a pagina de ontem.
  const r = gasto.resumo(new Date('2026-09-19T10:00:00Z'))
  assert.equal(r.hoje.reais, 0)
  assert.equal(r.hoje.chamadas, 0)
})

// ---------------------------------------------------------------------------
// TOTAL INCOMPLETO PRECISA APARECER COMO INCOMPLETO
// ---------------------------------------------------------------------------
//
// Modelo novo na VPS que a tabela ainda nao conhece: a chamada foi paga, so
// nao sabemos quanto. Somar zero faria o painel mostrar um total redondo que
// e mentira.

test('modelo fora da tabela conta como chamada e marca o total como incompleto', () => {
  limpar()
  const agora = new Date('2026-09-18T10:00:00Z')
  gasto.anotar({ tipo: 'conversa', modelo: 'claude-haiku-4-5', entrada: 1_000_000 }, agora)
  gasto.anotar({ tipo: 'trabalho', modelo: 'claude-modelo-novo', entrada: 999_999 }, agora)
  const r = gasto.resumo(agora)
  assert.equal(r.hoje.reais, 5)
  assert.equal(r.hoje.chamadas, 2)
  assert.equal(r.hoje.semPreco, 1)
  assert.equal(r.hoje.completo, false, 'o painel precisa saber que o total nao fecha')
})

test('le o usage da API sem trocar os nomes — trocar um faz o custo encolher', () => {
  const u = gasto.doUsage({
    input_tokens: 10,
    output_tokens: 20,
    cache_read_input_tokens: 30,
    cache_creation_input_tokens: 40,
  })
  assert.deepEqual(u, { entrada: 10, saida: 20, cache: 30, criacao: 40 })
})

// Contabilidade nao pode emudecer o Zeus. Disco cheio, permissao negada,
// caminho impossivel: o centavo se perde, a resposta ao Paulo sai.
test('anotar nunca derruba o Zeus, mesmo com caderno impossivel de gravar', () => {
  const antes = process.env.ZEUS_GASTO
  const pedra = path.join(PASTA, 'isto-e-um-arquivo')
  fs.writeFileSync(pedra, 'nao sou pasta')
  try {
    // Pasta que nao pode existir: o pai e um arquivo.
    process.env.ZEUS_GASTO = path.join(pedra, 'gasto.json')
    assert.doesNotThrow(() => gasto.anotar({ tipo: 'conversa', modelo: 'claude-haiku-4-5' }))
    assert.equal(gasto.ler(), null)
  } finally {
    process.env.ZEUS_GASTO = antes
  }
})
