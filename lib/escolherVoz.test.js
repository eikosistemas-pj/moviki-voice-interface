import test from 'node:test'
import assert from 'node:assert/strict'
import {
  escolherVelocidade,
  escolherVoz,
  VELOCIDADE_PADRAO,
  VOZES,
  VOZ_PADRAO,
} from './escolherVoz.js'

test('sem pedido, usa a voz padrao — e ela e brasileira', () => {
  assert.equal(escolherVoz(''), VOZ_PADRAO)
  assert.equal(escolherVoz(undefined), VOZ_PADRAO)
  // A primeira letra e o idioma no Kokoro: `p` de portugues. Se alguem trocar
  // o padrao por uma voz de outro idioma, este teste cai — e e para cair.
  assert.ok(VOZ_PADRAO.startsWith('p'), 'a voz padrao tem que ser brasileira')
})

test('pedido pela URL e atendido', () => {
  assert.equal(escolherVoz('?voz=pm_santa'), 'pm_santa')
  assert.equal(escolherVoz('?humor=firmeza&voz=pf_dora'), 'pf_dora')
})

test('nome inventado cai no padrao, nao vai para o servidor', () => {
  // Vem da barra de endereco: nao e dado de confianca.
  assert.equal(escolherVoz('?voz=qualquer_coisa'), VOZ_PADRAO)
  assert.equal(escolherVoz('?voz=../../etc/passwd'), VOZ_PADRAO)
  assert.equal(escolherVoz('?voz='), VOZ_PADRAO)
})

test('a italiana continua acessivel, so para comparar', () => {
  assert.equal(escolherVoz('?voz=im_nicola'), 'im_nicola')
  assert.ok(VOZES.im_nicola.includes('ITALIANA'))
})

test('ritmo da fala tambem sai da URL, dentro do razoavel', () => {
  assert.equal(escolherVelocidade(''), VELOCIDADE_PADRAO)
  assert.equal(escolherVelocidade('?vel=0.9'), 0.9)
  assert.equal(escolherVelocidade('?voz=pm_santa&vel=1.2'), 1.2)
})

test('ritmo absurdo e ignorado', () => {
  // Fora da faixa nao e ajuste, e defeito: voz arrastada ou correndo demais
  // ninguem entende.
  assert.equal(escolherVelocidade('?vel=5'), VELOCIDADE_PADRAO)
  assert.equal(escolherVelocidade('?vel=0.1'), VELOCIDADE_PADRAO)
  assert.equal(escolherVelocidade('?vel=abacaxi'), VELOCIDADE_PADRAO)
})
