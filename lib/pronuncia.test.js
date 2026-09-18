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

// ---------------------------------------------------------------------------
// COMO BRASILEIRO FALA DE VERDADE
// ---------------------------------------------------------------------------
//
// Paulo, 18/09/2026: "ele nao fala 'voce', ele poe entonacao no VO. Seria
// interessante instalar nele os vicios de linguagem brasileiros."

test('"voce" vira "ce", que e como se fala', () => {
  // Isto conserta as duas queixas de uma vez: a entonacao errada no "VO" e a
  // fala engessada.
  assert.equal(ajustarPronuncia('Você quer?'), 'Cê quer?')
  assert.equal(ajustarPronuncia('Abri isso para você.'), 'Abri isso procê.')
  assert.equal(ajustarPronuncia('Vocês estão vendo?'), 'Cês tão vendo?')
  // Em comeco de frase a maiuscula vem junto, tambem na forma contraida.
  assert.equal(ajustarPronuncia('Para você, já está pronto.'), 'Procê, já tá pronto.')
})

test('maiuscula de comeco de frase sobrevive a troca', () => {
  // Frase que comeca minuscula sai com a entonacao do meio de uma frase
  // anterior — o motor usa a caixa para saber onde a frase comeca.
  assert.equal(ajustarPronuncia('Estou indo.'), 'Tô indo.')
  assert.equal(ajustarPronuncia('eu estou indo.'), 'eu tô indo.')
})

test('o verbo "parar" NAO vira "pra"', () => {
  // "o robo para de trabalhar" viraria "o robo pra de trabalhar". Por isso so
  // as formas com artigo entram no dicionario.
  assert.equal(
    ajustarPronuncia('O robô para de trabalhar às seis.'),
    'O robô para de trabalhar às seis.'
  )
})

test('"nao e" no meio da frase fica intacto', () => {
  // "ne" so vale no fim ("ta pronto, ne?"). No meio, "isso nao e meu" viraria
  // "isso ne meu" — nao e sotaque, e erro.
  assert.equal(ajustarPronuncia('Isso não é meu, é seu.'), 'Isso não é meu, é seu.')
})

test('"para o" vira "pro" sem comer o que vem depois', () => {
  assert.equal(
    ajustarPronuncia('Abri o Pull Request para o painel.'),
    'Abri o pul rikuést pro painel.'
  )
  assert.equal(ajustarPronuncia('mandei para as duas'), 'mandei pras duas')
})

test('o sotaque nao atrapalha o dicionario de marca', () => {
  assert.equal(
    ajustarPronuncia('Você está no Moviki Enterprise.'),
    'Cê tá no Movíki enterpráiz.'
  )
})

test('o acento separa o verbo "parar" da preposicao "para"', () => {
  // "mandei para as duas" e preposicao: vira "pras duas".
  // "o robo para às seis" e o VERBO: nao pode virar "o robo pras seis".
  assert.equal(ajustarPronuncia('mandei para as duas'), 'mandei pras duas')
  assert.equal(ajustarPronuncia('O robô para às seis.'), 'O robô para às seis.')
  assert.equal(ajustarPronuncia('vou para a página'), 'vou pra página')
})
