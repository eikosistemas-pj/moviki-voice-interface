import test from 'node:test'
import assert from 'node:assert/strict'
import { ajustarPronuncia, DICIONARIO } from './pronuncia.js'

test('conserta as duas que o Paulo pegou no ouvido', () => {
  assert.match(ajustarPronuncia('o plano Enterprise custa mais'), /enterpráiz/)
  assert.match(ajustarPronuncia('o Moviki cresceu'), /Movíki/)
})

test('nao troca palavra dentro de outra palavra', () => {
  // "ia" nao pode casar dentro de "familia"; "pr" nao pode casar dentro de
  // "proximo". Se casar, o Zeus vira gago.
  assert.equal(ajustarPronuncia('a familia toda'), 'a familia toda')
  assert.equal(ajustarPronuncia('no proximo mes'), 'no proximo mes')
  assert.equal(ajustarPronuncia('prato feito'), 'prato feito')
})

test('pega a palavra colada em pontuacao', () => {
  assert.match(ajustarPronuncia('e o Enterprise.'), /enterpráiz\./)
  assert.match(ajustarPronuncia('(Moviki)'), /\(Movíki\)/)
  assert.match(ajustarPronuncia('Enterprise, Premium e Pro'), /enterpráiz,/)
})

test('maiuscula e acento nao atrapalham', () => {
  assert.match(ajustarPronuncia('MOVIKI'), /Movíki/)
  assert.match(ajustarPronuncia('Móviki'), /Movíki/)
  assert.match(ajustarPronuncia('ENTERPRISE'), /enterpráiz/)
})

test('termo de duas palavras vence o de uma', () => {
  // A ordem do dicionario existe por isto: se "pull" fosse trocado sozinho,
  // "pull request" nunca casaria.
  const r = ajustarPronuncia('tem um Pull Request aberto')
  assert.match(r, /pul rikuést/)
})

test('sigla sai letra por letra', () => {
  assert.match(ajustarPronuncia('isso e LGPD'), /éle gê pê dê/)
  assert.match(ajustarPronuncia('o CPF do lojista'), /cê pê éfe/)
})

test('texto sem nada do dicionario passa intacto', () => {
  const t = 'o lojista abriu a barraca na feira hoje de manha'
  assert.equal(ajustarPronuncia(t), t)
})

test('vazio nao quebra', () => {
  assert.equal(ajustarPronuncia(''), '')
  assert.equal(ajustarPronuncia(null), '')
  assert.equal(ajustarPronuncia(undefined), '')
})

test('o dicionario esta na ordem certa: frases antes de palavras soltas', () => {
  // Trava de manutencao: se alguem puser "pull" solto acima de "pull request",
  // este teste cai antes de o Zeus comecar a falar errado.
  const termos = DICIONARIO.map(([t]) => t)
  for (let i = 0; i < termos.length; i += 1) {
    for (let j = i + 1; j < termos.length; j += 1) {
      assert.ok(
        !termos[j].includes(` `) || !termos[j].includes(termos[i]),
        `"${termos[j]}" contem "${termos[i]}" e deveria vir ANTES dele`
      )
    }
  }
})
