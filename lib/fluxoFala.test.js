import test from 'node:test'
import assert from 'node:assert/strict'
import { criarFluxoFala } from './fluxoFala.js'
import { ALVO_PRIMEIRO } from './partirFala.js'

test('a primeira frase sai antes de o resto chegar', () => {
  // ESTE E O CONSERTO DA DEMORA. Se este teste cair, o Zeus voltou a esperar
  // a resposta inteira para abrir a boca.
  const f = criarFluxoFala()
  const primeiro = f.empurrar('O painel do lojista mudou essa semana. Entrou um ')
  assert.deepEqual(primeiro, ['O painel do lojista mudou essa semana.'])
})

test('nao entrega frase pela metade', () => {
  const f = criarFluxoFala()
  assert.deepEqual(f.empurrar('Assumi o posto e vou tocando'), [])
  assert.deepEqual(f.empurrar(' daqui'), [])
})

test('ponto sem espaco depois nao e fim de frase', () => {
  // "R$ 79." e "versao 4.5" tem ponto no meio. Cortar ali faria a voz frear
  // no meio de um numero.
  const f = criarFluxoFala()
  assert.deepEqual(f.empurrar('O Premium subiu para 79.'), [])
  assert.deepEqual(f.empurrar('90 reais por mes. '), [
    'O Premium subiu para 79.90 reais por mes.',
  ])
})

test('o primeiro pedaco e pequeno e os seguintes sao maiores', () => {
  const f = criarFluxoFala()
  const tudo = [
    ...f.empurrar(
      'Terminei aquilo. ' +
        'Abri um Pull Request no painel do lojista com o texto novo do rodape. ' +
        'Tem mais dois Pull Requests seus parados ha horas no site publico. ' +
        'No robo do dinheiro nao mexi. '
    ),
    ...f.encerrar(),
  ]
  assert.ok(tudo.length > 1, 'devia ter partido')
  assert.ok(
    tudo[0].length <= ALVO_PRIMEIRO,
    `o primeiro pedaco e o unico que o Paulo espera calado: ${tudo[0].length}`
  )
  // O segundo pode (e deve) ser maior: ele e sintetizado enquanto o primeiro
  // toca, entao o tamanho dele nao custa espera.
  assert.ok(tudo[1].length > tudo[0].length)
})

test('o que ficou no buffer sai no encerrar', () => {
  const f = criarFluxoFala()
  f.empurrar('Assumi o posto agora mesmo. Vou tocando')
  assert.deepEqual(f.encerrar(), ['Vou tocando'])
  assert.deepEqual(f.encerrar(), [])
})

test('nada perdido e nada repetido no caminho', () => {
  const inteiro =
    'Terminei o rodape. Abri um Pull Request no painel do lojista, com o texto ' +
    'que voce pediu. Tem dois Pull Requests seus parados. Me avise se quer que ' +
    'eu siga para o site publico.'

  const f = criarFluxoFala()
  const saiu = []
  // Chegando de tres em tres letras, como chega de verdade.
  for (let i = 0; i < inteiro.length; i += 3) {
    saiu.push(...f.empurrar(inteiro.slice(i, i + 3)))
  }
  saiu.push(...f.encerrar())

  assert.equal(saiu.join(' ').replace(/\s+/g, ' '), inteiro.replace(/\s+/g, ' '))
})

test('texto sem ponto nenhum nao deixa o Zeus mudo', () => {
  // Valvula de seguranca: sem nenhum fim de frase, corta num respiro em vez
  // de ficar acumulando calado para sempre.
  const f = criarFluxoFala()
  const saiu = f.empurrar(
    'entao o que acontece e que o painel do lojista mudou bastante essa semana, ' +
      'e entrou um botao novo na aba de artes, e a videoaula tambem foi corrigida, ' +
      'e ainda falta conferir o resto '
  )
  assert.ok(saiu.length >= 1, 'devia ter cortado numa virgula')
  assert.ok(saiu[0].length <= ALVO_PRIMEIRO)
})

test('vazio nao quebra', () => {
  const f = criarFluxoFala()
  assert.deepEqual(f.empurrar(''), [])
  assert.deepEqual(f.empurrar(null), [])
  assert.deepEqual(f.encerrar(), [])
})
