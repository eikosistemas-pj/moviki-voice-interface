import test from 'node:test'
import assert from 'node:assert/strict'
import {
  contarPatrulha,
  escolherAlvo,
  jaOlhados,
  marcarOlhado,
  patrulhasHoje,
} from './patrulha.js'

// ---------------------------------------------------------------------------
// A PATRULHA — ele lendo o codigo sem ninguem pedir
// ---------------------------------------------------------------------------
//
// Este e o primeiro pedaco do Zeus que GASTA DINHEIRO sem ninguem ter pedido.
// Os testes aqui cuidam dos freios, nao da capacidade: capacidade sem freio
// vira conta de luz e assistente que ninguem aguenta.

test('repositorio que nao mudou nao ganha patrulha', () => {
  // Reler o mesmo codigo intacto de hora em hora e queimar dinheiro para
  // chegar sempre na mesma conclusao.
  const commits = { moviki: 'aaa', 'moviki-app': 'bbb' }
  const vistos = { moviki: 'aaa', 'moviki-app': 'bbb' }
  assert.equal(escolherAlvo(commits, vistos), null)
})

test('so olha o que mudou', () => {
  const commits = { moviki: 'aaa', 'moviki-app': 'NOVO' }
  const vistos = { moviki: 'aaa', 'moviki-app': 'bbb' }
  assert.equal(escolherAlvo(commits, vistos), 'moviki-app')
})

test('quem nunca foi olhado tem a vez', () => {
  // Sem isso, um repositorio muito movimentado tomaria todas as rodadas e os
  // outros nunca seriam vistos.
  const commits = { moviki: 'aaa', 'moviki-app': 'bbb', 'moviki-ai': 'ccc' }
  const vistos = { moviki: 'MUDOU' }
  assert.equal(escolherAlvo(commits, vistos), 'moviki-app')
})

test('repositorio fora da lista permitida nunca e alvo', () => {
  // A patrulha le codigo. Ler o robo do dinheiro seria furar a cerca de
  // maos.js por uma porta que ninguem estava olhando.
  const commits = { 'moviki-robo': 'aaa', 'moviki-voice-interface': 'bbb' }
  assert.equal(escolherAlvo(commits, {}), null)
})

test('espelho ausente nao vira alvo', () => {
  assert.equal(escolherAlvo({}, {}), null)
  assert.equal(escolherAlvo(null, {}), null)
})

test('o teto do dia conta e zera na virada', () => {
  const e = {}
  assert.equal(patrulhasHoje(e, '2026-09-18'), 0)
  contarPatrulha(e, '2026-09-18')
  contarPatrulha(e, '2026-09-18')
  assert.equal(patrulhasHoje(e, '2026-09-18'), 2)
  // Dia novo, conta nova.
  assert.equal(patrulhasHoje(e, '2026-09-19'), 0)
})

test('o que ja foi olhado fica guardado', () => {
  const e = {}
  marcarOlhado(e, 'moviki-app', 'sha123')
  assert.deepEqual(jaOlhados(e), { 'moviki-app': 'sha123' })
  // E marcar um nao apaga o outro.
  marcarOlhado(e, 'moviki', 'sha456')
  assert.deepEqual(jaOlhados(e), { 'moviki-app': 'sha123', moviki: 'sha456' })
})

test('marcar olhado nao apaga a contagem do dia', () => {
  const e = {}
  contarPatrulha(e, '2026-09-18')
  marcarOlhado(e, 'moviki', 'sha')
  assert.equal(patrulhasHoje(e, '2026-09-18'), 1)
})
