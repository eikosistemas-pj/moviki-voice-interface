import test from 'node:test'
import assert from 'node:assert/strict'
import { criarPorta, iguaisNoEscuro } from './porta.js'

const SENHA = 'segredo-do-paulo'

test('senha certa entra e recebe cracha', () => {
  const porta = criarPorta({ senha: SENHA })
  const r = porta.entrar(SENHA, '1.2.3.4')
  assert.equal(r.ok, true)
  assert.ok(r.cracha.length > 30)
  assert.equal(porta.vale(r.cracha), true)
})

test('senha errada nao entra', () => {
  const porta = criarPorta({ senha: SENHA })
  assert.equal(porta.entrar('chute', '1.2.3.4').ok, false)
  assert.equal(porta.entrar('', '1.2.3.4').ok, false)
})

test('cracha inventado nao vale', () => {
  const porta = criarPorta({ senha: SENHA })
  assert.equal(porta.vale('abc123'), false)
  assert.equal(porta.vale(''), false)
  assert.equal(porta.vale(undefined), false)
})

test('cada cracha e diferente', () => {
  const porta = criarPorta({ senha: SENHA })
  const a = porta.entrar(SENHA).cracha
  const b = porta.entrar(SENHA).cracha
  assert.notEqual(a, b)
})

test('cracha vence e para de valer', () => {
  let relogio = 1000
  const porta = criarPorta({ senha: SENHA, validadeMs: 100, agora: () => relogio })
  const { cracha } = porta.entrar(SENHA)
  assert.equal(porta.vale(cracha), true)
  relogio += 101
  assert.equal(porta.vale(cracha), false)
})

test('errar cinco vezes tranca a porta para aquele endereco', () => {
  // Sem isso, quem tiver tempo descobre a senha tentando uma por uma.
  let relogio = 1000
  const porta = criarPorta({ senha: SENHA, agora: () => relogio })
  for (let i = 0; i < 5; i += 1) porta.entrar('chute', '9.9.9.9')

  const r = porta.entrar(SENHA, '9.9.9.9')
  assert.equal(r.ok, false)
  assert.equal(r.motivo, 'porta_trancada', 'nem a senha certa entra no castigo')
})

test('o castigo e por endereco, nao para todo mundo', () => {
  // Se fosse geral, bastaria alguem errar cinco vezes para trancar o Paulo
  // do lado de fora da propria casa.
  const porta = criarPorta({ senha: SENHA })
  for (let i = 0; i < 6; i += 1) porta.entrar('chute', '9.9.9.9')
  assert.equal(porta.entrar(SENHA, '1.1.1.1').ok, true)
})

test('o castigo passa', () => {
  let relogio = 1000
  const porta = criarPorta({ senha: SENHA, agora: () => relogio })
  for (let i = 0; i < 5; i += 1) porta.entrar('chute', '9.9.9.9')
  relogio += 16 * 60 * 1000
  assert.equal(porta.entrar(SENHA, '9.9.9.9').ok, true)
})

test('acertar a senha limpa a ficha de erros', () => {
  const porta = criarPorta({ senha: SENHA })
  porta.entrar('chute', '5.5.5.5')
  porta.entrar('chute', '5.5.5.5')
  porta.entrar(SENHA, '5.5.5.5')
  // Os dois erros anteriores nao contam mais: agora leva cinco novos.
  for (let i = 0; i < 4; i += 1) porta.entrar('chute', '5.5.5.5')
  assert.equal(porta.entrar(SENHA, '5.5.5.5').ok, true)
})

test('revogar derruba o cracha', () => {
  const porta = criarPorta({ senha: SENHA })
  const { cracha } = porta.entrar(SENHA)
  porta.revogar(cracha)
  assert.equal(porta.vale(cracha), false)
})

test('revogar sem argumento derruba todos', () => {
  const porta = criarPorta({ senha: SENHA })
  const a = porta.entrar(SENHA).cracha
  const b = porta.entrar(SENHA).cracha
  porta.revogar()
  assert.equal(porta.vale(a), false)
  assert.equal(porta.vale(b), false)
})

test('sem senha configurada a porta fica aberta — e o servidor tem que gritar', () => {
  // Nao e o comportamento desejado; e o comportamento honesto. Quem decide
  // se isso pode e o servidor, que avisa em letras garrafais ao subir.
  const porta = criarPorta({})
  assert.equal(porta.exigeSenha(), false)
  assert.equal(porta.vale('qualquer-coisa'), true)
})

test('a comparacao nao entrega a senha pelo tempo de resposta', () => {
  // Comparacao comum para na primeira letra diferente, e o tempo disso diz
  // quantas letras estavam certas. Aqui e sempre o mesmo trabalho.
  assert.equal(iguaisNoEscuro('abc', 'abc'), true)
  assert.equal(iguaisNoEscuro('abc', 'abd'), false)
  assert.equal(iguaisNoEscuro('abc', 'abcdefghijklmnop'), false)
  assert.equal(iguaisNoEscuro('', ''), true)
})
