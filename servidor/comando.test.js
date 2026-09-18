// servidor/comando.test.js
//
// O teste que importa aqui e o do falso positivo: o Zeus nao pode assumir
// porque o Paulo falou uma palavra parecida.

import test from 'node:test'
import assert from 'node:assert/strict'
import { assuntoVedado, entender } from './comando.js'
import { PEDIDOS } from '../lib/turno.js'

test('"Zeus, assuma daqui" passa o posto', () => {
  assert.equal(entender('Zeus, assuma daqui').tipo, PEDIDOS.ABRIR_TURNO)
  assert.equal(entender('zeus assume o comando').tipo, PEDIDOS.ABRIR_TURNO)
  assert.equal(entender('pode assumir'). tipo, PEDIDOS.ABRIR_TURNO)
})

test('"Zeus, acabei de chegar" devolve o posto', () => {
  assert.equal(entender('Zeus, acabei de chegar').tipo, PEDIDOS.FECHAR_TURNO)
  assert.equal(entender('cheguei').tipo, PEDIDOS.FECHAR_TURNO)
  assert.equal(entender('voltei, como estao as coisas').tipo, PEDIDOS.FECHAR_TURNO)
  assert.equal(entender('estou de volta').tipo, PEDIDOS.FECHAR_TURNO)
})

test('"eu assumo daqui" e o PAULO retomando, nao o Zeus assumindo', () => {
  // Este e o teste que existe por causa de um erro de verdade: as duas frases
  // tem a mesma raiz. Se a ordem da leitura inverter, o Zeus assume justo na
  // hora em que o Paulo disse que estava voltando.
  assert.equal(entender('eu assumo daqui, Zeus').tipo, PEDIDOS.FECHAR_TURNO)
  assert.equal(entender('assumo daqui').tipo, PEDIDOS.FECHAR_TURNO)
  assert.equal(entender('assumo o comando agora').tipo, PEDIDOS.FECHAR_TURNO)
})

test('negacao nao abre turno', () => {
  const r = entender('nao assuma nada por enquanto')
  assert.notEqual(r.tipo, PEDIDOS.ABRIR_TURNO)
})

test('acento e caixa nao mudam o entendimento', () => {
  assert.equal(entender('ZEUS, ASSUMA DAQUÍ').tipo, PEDIDOS.ABRIR_TURNO)
  assert.equal(entender('Acabei de Chegar').tipo, PEDIDOS.FECHAR_TURNO)
})

test('pedido comum vira ordem de trabalho', () => {
  assert.equal(entender('como esta a Tesouraria hoje').tipo, PEDIDOS.EXECUTAR)
  assert.equal(entender('poe o Gabinete para conferir o mapa').tipo, PEDIDOS.EXECUTAR)
})

test('palavra parecida nao abre turno', () => {
  // "resumo", "consumo", "presumo" carregam "sum", nao "assum".
  assert.equal(entender('me da um resumo do dia').tipo, PEDIDOS.EXECUTAR)
  assert.equal(entender('qual foi o consumo de hoje').tipo, PEDIDOS.EXECUTAR)
})

test('frase vazia nao vira comando nenhum', () => {
  assert.equal(entender('').tipo, null)
  assert.equal(entender('   ').tipo, null)
  assert.equal(entender(null).tipo, null)
})

// --- Assunto vedado -------------------------------------------------------
// Falar sobre e livre; mexer nao e. Sem essa separacao, ou a trava fica de
// enfeite, ou o Zeus fica mudo sobre metade da empresa.

test('mandar MEXER em assunto proibido e barrado', () => {
  assert.equal(assuntoVedado('aprova o pull request do painel'), 'aprovar_pr')
  assert.equal(assuntoVedado('sobe o Premium para setenta e nove'), 'preco')
  assert.equal(assuntoVedado('paga a comissao do parceiro'), 'dinheiro')
  assert.equal(assuntoVedado('altera a regra do firestore'), 'seguranca')
  assert.equal(assuntoVedado('troca a chave da Anthropic'), 'segredo')
  assert.equal(assuntoVedado('publica no instagram'), 'publicar')
  assert.equal(assuntoVedado('apaga o repositorio antigo'), 'apagar')
})

test('PERGUNTAR sobre assunto proibido continua livre', () => {
  // Trava que atrapalha o dono vira trava que o dono manda tirar.
  assert.equal(assuntoVedado('quanto custa o Premium'), null)
  assert.equal(assuntoVedado('como esta a comissao do parceiro esse mes'), null)
  assert.equal(assuntoVedado('qual o plano pra hoje'), null)
  assert.equal(assuntoVedado('tem pull request aberto'), null)
})

test('mandar apagar sem dizer o que e barrado assim mesmo', () => {
  // Apagar e o unico verbo da lista que nao tem volta.
  assert.equal(assuntoVedado('apaga aquilo la'), 'apagar')
  assert.equal(assuntoVedado('derruba isso'), 'apagar')
})

test('entender() ja devolve o assunto junto', () => {
  const r = entender('aprova o pull request')
  assert.equal(r.tipo, PEDIDOS.EXECUTAR)
  assert.equal(r.assunto, 'aprovar_pr')
})

test('ordem comum nao carrega assunto vedado', () => {
  assert.equal(entender('poe o Gabinete para conferir o mapa').assunto, null)
})

test('nome de plano conta como preco; "pro" solto nao', () => {
  // O Paulo fala "sobe o Premium", nao "sobe o preco do plano Premium".
  assert.equal(assuntoVedado('sobe o Premium para setenta e nove'), 'preco')
  assert.equal(assuntoVedado('muda o Enterprise'), 'preco')
  // "pro" em fala corrente e "para o": nao pode virar mexida em preco.
  assert.equal(assuntoVedado('muda pro azul'), null)
})
