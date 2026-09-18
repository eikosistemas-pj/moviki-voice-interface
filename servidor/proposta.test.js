import test from 'node:test'
import assert from 'node:assert/strict'
import { nomearRamo, validar } from './proposta.js'

const BOA = {
  repo: 'moviki-app',
  ramo: 'zeus/ajusta-texto-0918',
  titulo: 'Ajusta o texto da aba de artes',
  arquivos: [{ caminho: 'parceiro.html', conteudo: '<html></html>' }],
}

test('proposta boa passa', () => {
  assert.equal(validar(BOA).ok, true)
})

test('main e recusada com todas as letras', () => {
  const r = validar({ ...BOA, ramo: 'main' })
  assert.equal(r.ok, false)
  assert.ok(r.erros.some((e) => e.includes('main')))
})

test('a conferencia roda mesmo com o cerebro instruido', () => {
  // Instrucao e pedido; isto e trava. A diferenca aparece no dia em que
  // alguem convencer o cerebro a pedir outra coisa.
  const r = validar({ ...BOA, repo: 'moviki-robo' })
  assert.equal(r.ok, false)
  assert.ok(r.erros.some((e) => e.includes('dinheiro')))
})

test('um arquivo proibido derruba a proposta inteira', () => {
  const r = validar({
    ...BOA,
    arquivos: [
      { caminho: 'index.html', conteudo: 'ok' },
      { caminho: 'firebase/firestore.rules', conteudo: 'nao' },
    ],
  })
  assert.equal(r.ok, false)
  assert.ok(r.erros.some((e) => e.includes('firestore.rules')))
})

test('proposta vazia nao passa', () => {
  assert.equal(validar({ ...BOA, arquivos: [] }).ok, false)
  assert.equal(validar({}).ok, false)
  assert.equal(validar(null).ok, false)
})

test('proposta gigante nao passa', () => {
  // Proposta que ninguem revisa nao e proposta, e risco embrulhado.
  const muitos = Array.from({ length: 20 }, (_, i) => ({
    caminho: `a${i}.html`,
    conteudo: 'x',
  }))
  assert.equal(validar({ ...BOA, arquivos: muitos }).ok, false)
})

test('o mesmo arquivo duas vezes e recusado', () => {
  const r = validar({
    ...BOA,
    arquivos: [
      { caminho: 'index.html', conteudo: 'um' },
      { caminho: 'index.html', conteudo: 'dois' },
    ],
  })
  assert.equal(r.ok, false)
  assert.ok(r.erros.some((e) => e.includes('duas vezes')))
})

test('titulo vago nao passa', () => {
  assert.equal(validar({ ...BOA, titulo: 'ajuste' }).ok, false)
})

test('nome de ramo sai limpo e carimbado', () => {
  const n = nomearRamo('Ajusta a Videoaula do Parceiro!', new Date('2026-09-18T14:30:00Z'))
  assert.match(n, /^zeus\/ajusta-a-videoaula-do-parceiro-\d+$/)
})

test('dois pedidos iguais no mesmo dia nao colidem', () => {
  // Ramo que ja existe faz o envio falhar no meio do trabalho.
  const a = nomearRamo('mesmo pedido', new Date('2026-09-18T14:30:00Z'))
  const b = nomearRamo('mesmo pedido', new Date('2026-09-18T15:45:00Z'))
  assert.notEqual(a, b)
})

test('pedido so com simbolos ainda gera ramo valido', () => {
  assert.match(nomearRamo('!!!???'), /^zeus\/trabalho-\d+$/)
})
