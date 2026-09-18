import test from 'node:test'
import assert from 'node:assert/strict'
import { fraseDeAviso, montarAviso } from './aviso.js'

const PRONTA = {
  ordem: 'trocar a cor do botao da pagina principal',
  ok: true,
  link: 'https://github.com/eikosistemas-pj/moviki/pull/12',
}

test('conta que terminou, sem soletrar o endereco', () => {
  // Soletrar link em voz alta e tortura. Ele vai na resposta escrita.
  const f = fraseDeAviso(PRONTA)
  assert.match(f, /Terminei/)
  assert.match(f, /aprovar/)
  assert.ok(!f.includes('github.com'), 'nao pode falar o endereco')
  assert.ok(!f.includes('http'), 'nao pode falar o endereco')
})

test('quando nao deu, diz o motivo', () => {
  const f = fraseDeAviso({
    ordem: 'mexer na comissao',
    ok: false,
    erros: ['nao encosto no robo do dinheiro'],
  })
  assert.match(f, /Nao consegui/)
  assert.match(f, /robo do dinheiro/)
})

test('duas terminadas viram UM aviso', () => {
  // Dois avisos seguidos fariam o Zeus falar por cima de si mesmo, e o Paulo
  // perderia o primeiro.
  const a = montarAviso([PRONTA, { ...PRONTA, ordem: 'outra coisa' }])
  assert.match(a.fala, /Terminei 2 coisas/)
  assert.equal(a.links.length, 2)
})

test('o link volta separado, para a tela mostrar', () => {
  const a = montarAviso([PRONTA])
  assert.deepEqual(a.links, [PRONTA.link])
})

test('sem tarefa nao ha aviso — o Zeus fica calado', () => {
  assert.equal(montarAviso([]), null)
  assert.equal(montarAviso(null), null)
  assert.equal(fraseDeAviso(null), null)
})
