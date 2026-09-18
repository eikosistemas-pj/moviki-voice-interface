import test from 'node:test'
import assert from 'node:assert/strict'
import { formatarRetrato, REPOS } from './olhos.js'

const QUANDO = new Date('2026-09-18T14:30:00Z')

test('o retrato diz quando foi lido e que pode ser tratado como fato', () => {
  const t = formatarRetrato([], QUANDO)
  assert.match(t, /2026-09-18 14:30 UTC/)
  assert.match(t, /Pode falar como fato/)
})

test('mostra ramo e commits de cada repositorio', () => {
  const t = formatarRetrato(
    [{ repo: 'moviki-app', ramo: 'main', commits: ['2026-09-17  Conserta a videoaula'] }],
    QUANDO
  )
  assert.match(t, /moviki-app — ramo main/)
  assert.match(t, /Conserta a videoaula/)
})

test('repositorio sem espelho e dito com todas as letras', () => {
  // Silencio aqui viraria o Zeus achando que o repo nao tem novidade, quando
  // na verdade ele nunca olhou.
  const t = formatarRetrato([{ repo: 'moviki-robo', ausente: true }], QUANDO)
  assert.match(t, /moviki-robo: sem espelho/)
})

test('o retrato avisa o que ele NAO sabe', () => {
  // Esta e a parte que impede o Zeus de inventar numero de lojista. Sem ela,
  // um assistente prestativo chuta — e chute com voz de comando vira decisao.
  const t = formatarRetrato([], QUANDO)
  assert.match(t, /NAO COBRE/)
  assert.match(t, /Firestore/)
  assert.match(t, /nunca invente/)
})

test('o cofre do Obsidian fica de fora da lista', () => {
  // O mapa mestre e explicito: nunca publicar nada que venha do vault. E o
  // Zeus fala em voz alta — o que ele sabe, ele diz.
  assert.ok(!REPOS.includes('moviki-vault'))
  assert.equal(REPOS.length, 6)
})
