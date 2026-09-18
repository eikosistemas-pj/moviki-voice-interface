import test from 'node:test'
import assert from 'node:assert/strict'
import { criarFluxoFala } from './fluxoFala.js'
import { ALVO_MAXIMO, ALVO_PRIMEIRO, alvoDoPedaco } from './partirFala.js'

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
  const saiu = [
    ...f.empurrar('Assumi o posto agora mesmo. Vou tocando'),
    ...f.encerrar(),
  ]
  assert.equal(saiu.join(' '), 'Assumi o posto agora mesmo. Vou tocando')
  assert.deepEqual(f.encerrar(), [])
})

test('a abertura curta NUNCA sai sozinha', () => {
  // ISTO E O CONSERTO DA PAUSA DE QUATRO SEGUNDOS — 18/09/2026, fim do dia.
  //
  // O Zeus abria com "Sim." (quatro letras, meio segundo de audio) e o pedaco
  // seguinte era grande demais para a maquina preparar nesse meio segundo.
  // Sobrava o buraco, e o Paulo ouviu: "ele responde a frase, ai passa uns
  // quatro, cinco segundos para continuar o raciocinio".
  for (const resposta of [
    'Sim. Abri o Pull Request no painel do lojista.',
    'Certo. Vou olhar o site agora.',
    'Nao. Isso e seu, nao meu.',
  ]) {
    const f = criarFluxoFala()
    const saiu = [...f.empurrar(resposta), ...f.encerrar()]
    assert.ok(
      saiu[0].length >= 20,
      `abertura saiu sozinha: "${saiu[0]}" (${saiu[0].length} letras)`
    )
    assert.equal(saiu.join(' '), resposta, 'e nada pode se perder')
  }
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
  // de ficar acumulando calado para sempre. Aqui a primeira virgula ja passa
  // do alvo — e mesmo assim sair e melhor que ficar calado.
  const f = criarFluxoFala()
  const saiu = f.empurrar(
    'entao o que acontece e que o painel do lojista mudou bastante essa semana, ' +
      'e entrou um botao novo na aba de artes, e a videoaula tambem foi corrigida, ' +
      'e ainda falta conferir o resto '
  )
  assert.ok(saiu.length >= 1, 'devia ter cortado numa virgula')
  assert.ok(saiu[0].endsWith(','), `cortou em lugar torto: "${saiu[0].slice(-20)}"`)
})

test('virgula salva o segundo pedaco de ficar grande demais', () => {
  // ESTE E O CONSERTO DO BURACO. Frase curta seguida de uma comprida: so com
  // fim de frase, os pedacos ficariam 18 e 69, e a maquina nao prepara 69
  // letras no tempo em que 18 tocam — dois segundos de silencio no meio.
  const f = criarFluxoFala()
  const saiu = [
    ...f.empurrar(
      'Terminei o rodape. Abri um Pull Request no painel do lojista, ' +
        'com o texto que voce pediu. Me avise se quer que eu siga. '
    ),
    ...f.encerrar(),
  ]
  // A abertura curta vai JUNTO com o comeco da explicacao: "Terminei o rodape."
  // sozinha deixaria um buraco de segundos antes do resto.
  assert.ok(saiu[0].startsWith('Terminei o rodape.'))
  assert.ok(saiu[0].length >= 20, `abertura saiu sozinha: "${saiu[0]}"`)
  assert.ok(
    saiu[saiu.length - 1].length <= alvoDoPedaco(saiu.length - 1) * 2,
    'nenhum degrau pode estourar o alvo em mais do que o dobro'
  )
})

test('a escada cresce e para no teto', () => {
  // Degrau que nao cresce faz o Zeus demorar a abrir a boca; degrau que cresce
  // demais faz a fila atrasar e ele calar no meio.
  assert.equal(alvoDoPedaco(0), ALVO_PRIMEIRO)
  assert.ok(alvoDoPedaco(1) > alvoDoPedaco(0))
  assert.ok(alvoDoPedaco(2) > alvoDoPedaco(1))
  assert.equal(alvoDoPedaco(20), ALVO_MAXIMO)
})

test('vazio nao quebra', () => {
  const f = criarFluxoFala()
  assert.deepEqual(f.empurrar(''), [])
  assert.deepEqual(f.empurrar(null), [])
  assert.deepEqual(f.encerrar(), [])
})
