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

// ---------------------------------------------------------------------------
// A PREVISAO DE TEMPO
// ---------------------------------------------------------------------------
//
// "Seria interessante ele saber uma projecao de quanto tempo leva." — Paulo,
// 18/09/2026. A previsao sai do que ele MESMO levou, nunca de chute.

import { fecharTarefa, minutosTipicos } from './estado.js'

test('sem historico ele nao promete prazo nenhum', () => {
  // Prazo inventado e estourado toda vez destroi a confianca mais rapido que
  // nenhum prazo.
  assert.equal(minutosTipicos({}, 'trabalho'), null)
  assert.equal(minutosTipicos({ duracoes: { trabalho: [60000] } }, 'trabalho'), null)
})

test('a previsao sai do que ele levou de verdade', () => {
  const e = { duracoes: { trabalho: [120000, 180000, 240000] } }
  assert.equal(minutosTipicos(e, 'trabalho'), 3)
})

test('uma tarefa que estourou nao estraga a previsao', () => {
  // MEDIANA e nao media: um estouro de 10 minutos puxaria a media e faria ele
  // prometer mal para sempre.
  const e = { duracoes: { trabalho: [120000, 120000, 120000, 600000] } }
  assert.equal(minutosTipicos(e, 'trabalho'), 2)
})

test('trabalho e analise tem previsoes separadas', () => {
  const e = { duracoes: { trabalho: [300000, 300000], analise: [60000, 60000] } }
  assert.equal(minutosTipicos(e, 'trabalho'), 5)
  assert.equal(minutosTipicos(e, 'analise'), 1)
})

test('fechar a tarefa guarda quanto ela levou', () => {
  const inicio = Date.now()
  const e = {
    tarefas: [
      { id: 't1', tipo: 'trabalho', estado: 'trabalhando', em: new Date(inicio).toISOString() },
    ],
  }
  fecharTarefa(e, 't1', { ok: true, link: 'x' }, inicio + 4 * 60 * 1000)
  assert.equal(e.tarefas[0].levouMs, 4 * 60 * 1000)
  assert.deepEqual(e.duracoes.trabalho, [4 * 60 * 1000])
})
