import test from 'node:test'
import assert from 'node:assert/strict'
import { partirFala } from './partirFala.js'

test('resposta curta nao e partida', () => {
  // Partir aqui so acrescentaria um pedido a mais, sem ganhar nada.
  const t = 'Assumi. Te conto quando terminar.'
  assert.deepEqual(partirFala(t), [t])
})

test('resposta longa e partida em fim de frase', () => {
  const t =
    'O painel do lojista mudou essa semana. ' +
    'Entrou um botao novo na aba de artes do parceiro, e a videoaula foi corrigida. ' +
    'Tem dois Pull Requests esperando sua aprovacao no site publico. ' +
    'No robo do dinheiro nao houve nada.'
  const pedacos = partirFala(t)
  assert.ok(pedacos.length > 1, 'devia ter partido')
  // Nenhum pedaco pode comecar no meio de uma frase.
  for (const p of pedacos) {
    assert.match(p[0], /[A-ZÀ-Ý]/, `pedaco comecou torto: "${p.slice(0, 30)}"`)
  }
  // E o texto nao pode ter perdido nada pelo caminho.
  assert.equal(pedacos.join(' ').replace(/\s+/g, ' '), t.replace(/\s+/g, ' ').trim())
})

test('nao corta no meio da frase', () => {
  // Corte no meio faz a voz cair de entonacao e soar picotada — o remedio
  // ficaria pior que a doenca.
  const t = `${'Uma frase bem comprida que sozinha ja passa do alvo e continua indo sem ponto nenhum ate aqui'.repeat(2)}.`
  const pedacos = partirFala(t)
  assert.equal(pedacos.length, 1, 'sem ponto para cortar, fica inteira')
})

test('sobra minuscula gruda no pedaco anterior', () => {
  // Um "Certo." solto viraria um pedido inteiro para meio segundo de audio.
  const t = `${'Frase de tamanho razoavel que ocupa bastante espaco no pedaco. '.repeat(4)}Certo.`
  const pedacos = partirFala(t)
  assert.ok(pedacos[pedacos.length - 1].length > 20)
  assert.ok(pedacos[pedacos.length - 1].endsWith('Certo.'))
})

test('pergunta e exclamacao tambem servem de corte', () => {
  const t = `${'Voce quer que eu mexa no painel do lojista agora ou depois do almoco? '.repeat(3)}Me diga.`
  assert.ok(partirFala(t).length > 1)
})

test('vazio nao quebra', () => {
  assert.deepEqual(partirFala(''), [])
  assert.deepEqual(partirFala('   '), [])
  assert.deepEqual(partirFala(null), [])
  assert.deepEqual(partirFala(undefined), [])
})
