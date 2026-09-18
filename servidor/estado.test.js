import test from 'node:test'
import assert from 'node:assert/strict'
import { enterrarOrfas, tarefasEmAndamento, tarefasParaContar } from './estado.js'

// ---------------------------------------------------------------------------
// NENHUMA TAREFA PODE SER IMORTAL
// ---------------------------------------------------------------------------
//
// 18/09/2026: o Paulo pediu a cor de um botao de manha e a tarde o Zeus ainda
// dizia "esta em andamento". A tarefa tinha morrido e ficado gravada como
// "trabalhando" para sempre — e tarefa "trabalhando" nao entra na fila do que
// ele tem para contar, entao o aviso nunca vinha.

const MIN = 60 * 1000

function estadoCom(tarefas) {
  return { tarefas }
}

test('tarefa em andamento aparece com o relogio', () => {
  const agora = Date.now()
  const e = estadoCom([
    { id: 't1', ordem: 'muda a cor do botao', repo: 'moviki-app', estado: 'trabalhando', em: new Date(agora - 7 * MIN).toISOString() },
  ])
  const andando = tarefasEmAndamento(e, agora)
  assert.equal(andando.length, 1)
  assert.equal(andando[0].minutos, 7)
})

test('restart enterra quem estava trabalhando', () => {
  // Quem trabalhava vivia na memoria do processo que morreu. Nao ha o que
  // esperar: ou vira falha agora, ou fica imortal para sempre.
  const agora = Date.now()
  const e = estadoCom([
    { id: 't1', ordem: 'muda a cor', estado: 'trabalhando', em: new Date(agora - 30 * 1000).toISOString() },
    { id: 't2', ordem: 'ja pronta', estado: 'pronta', ok: true, contada: true, em: new Date(agora).toISOString() },
  ])
  const mortas = enterrarOrfas(e, { limiteMs: 0, motivo: 'o servidor reiniciou', agora })

  assert.equal(mortas.length, 1)
  assert.equal(e.tarefas[0].estado, 'falhou')
  assert.equal(e.tarefas[0].ok, false)
  // E o mais importante: agora ela ENTRA na fila do que ele tem para contar.
  assert.equal(tarefasParaContar(e).length, 1)
  // A que ja estava pronta e contada nao pode ser mexida.
  assert.equal(e.tarefas[1].estado, 'pronta')
})

test('a ronda so enterra quem passou do prazo', () => {
  const agora = Date.now()
  const e = estadoCom([
    { id: 'nova', ordem: 'comecou agora', estado: 'trabalhando', em: new Date(agora - 2 * MIN).toISOString() },
    { id: 'velha', ordem: 'de manha', estado: 'trabalhando', em: new Date(agora - 300 * MIN).toISOString() },
  ])
  const mortas = enterrarOrfas(e, { limiteMs: 12 * MIN, motivo: 'passou do prazo', agora })

  assert.deepEqual(mortas.map((t) => t.id), ['velha'])
  assert.equal(e.tarefas[0].estado, 'trabalhando', 'a que comecou agora continua')
})

test('a tarefa enterrada conta o motivo, nao some calada', () => {
  const agora = Date.now()
  const e = estadoCom([{ id: 't1', ordem: 'x', estado: 'trabalhando', em: new Date(agora - MIN).toISOString() }])
  enterrarOrfas(e, { limiteMs: 0, motivo: 'o servidor reiniciou no meio', agora })
  assert.match(e.tarefas[0].erros[0], /reiniciou/)
  assert.equal(e.tarefas[0].contada, false)
})

test('enterrar duas vezes nao ressuscita nem duplica', () => {
  const agora = Date.now()
  const e = estadoCom([{ id: 't1', ordem: 'x', estado: 'trabalhando', em: new Date(agora - MIN).toISOString() }])
  enterrarOrfas(e, { limiteMs: 0, agora })
  const segunda = enterrarOrfas(e, { limiteMs: 0, agora })
  assert.equal(segunda.length, 0)
  assert.equal(tarefasParaContar(e).length, 1)
})

test('sem tarefa nenhuma nao quebra', () => {
  assert.deepEqual(tarefasEmAndamento({}), [])
  assert.deepEqual(enterrarOrfas({}, { limiteMs: 0 }), [])
})
