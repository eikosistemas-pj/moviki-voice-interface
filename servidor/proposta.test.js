import test from 'node:test'
import assert from 'node:assert/strict'
import { aplicarTroca, nomearRamo, validar } from './proposta.js'

const BOA = {
  repo: 'moviki-app',
  ramo: 'zeus/ajusta-texto-0918',
  titulo: 'Ajusta a cor do botao de entrar',
  arquivos: [
    {
      caminho: 'parceiro.html',
      procurar: 'background: #1f6feb; border-radius: 12px',
      trocar_por: 'background: #10b981; border-radius: 12px',
    },
  ],
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
      ...BOA.arquivos,
      { caminho: 'firebase/firestore.rules', conteudo: 'nao' },
    ],
  })
  assert.equal(r.ok, false)
  assert.ok(r.erros.some((e) => e.includes('firestore.rules')))
})

// --- O erro de projeto que custou dez minutos ------------------------------

test('ancora curta demais e recusada', () => {
  // "div" ou "azul" casam em cem lugares do arquivo, e a troca cai no lugar
  // errado. Exigir tamanho obriga o Zeus a citar algo que ele leu mesmo.
  const r = validar({
    ...BOA,
    arquivos: [{ caminho: 'index.html', procurar: 'azul', trocar_por: 'verde' }],
  })
  assert.equal(r.ok, false)
  assert.ok(r.erros.some((e) => e.includes('curto demais')))
})

test('trecho novo igual ao antigo nao passa', () => {
  const r = validar({
    ...BOA,
    arquivos: [
      { caminho: 'index.html', procurar: 'background: #1f6feb;', trocar_por: 'background: #1f6feb;' },
    ],
  })
  assert.equal(r.ok, false)
  assert.ok(r.erros.some((e) => e.includes('nao muda nada')))
})

test('trecho gigante e recusado — isso e reescrever o arquivo de novo', () => {
  const r = validar({
    ...BOA,
    arquivos: [
      { caminho: 'index.html', procurar: 'x'.repeat(30_000), trocar_por: 'y' },
    ],
  })
  assert.equal(r.ok, false)
  assert.ok(r.erros.some((e) => e.includes('grande demais')))
})

test('ou troca um trecho, ou cria arquivo — nunca os dois', () => {
  const r = validar({
    ...BOA,
    arquivos: [
      { caminho: 'novo.html', procurar: 'alguma coisa longa', trocar_por: 'outra', conteudo: 'x' },
    ],
  })
  assert.equal(r.ok, false)
})

test('arquivo novo passa sem ancora — ele ainda nao existe', () => {
  const r = validar({
    ...BOA,
    arquivos: [{ caminho: 'nova-pagina.html', conteudo: '<html></html>' }],
  })
  assert.equal(r.ok, true)
})

test('alteracao sem trecho nem conteudo nao passa', () => {
  const r = validar({ ...BOA, arquivos: [{ caminho: 'index.html' }] })
  assert.equal(r.ok, false)
})

test('proposta vazia nao passa', () => {
  assert.equal(validar({ ...BOA, arquivos: [] }).ok, false)
  assert.equal(validar({}).ok, false)
  assert.equal(validar(null).ok, false)
})

test('proposta gigante nao passa', () => {
  const muitos = Array.from({ length: 20 }, (_, i) => ({
    caminho: `a${i}.html`,
    conteudo: 'x',
  }))
  assert.equal(validar({ ...BOA, arquivos: muitos }).ok, false)
})

test('titulo vago nao passa', () => {
  assert.equal(validar({ ...BOA, titulo: 'ajuste' }).ok, false)
})

// --- A troca em si --------------------------------------------------------

test('troca o trecho no lugar certo, sem tocar no resto', () => {
  const antes = 'linha um\nbotao: azul escuro\nlinha tres'
  const r = aplicarTroca(antes, { procurar: 'botao: azul escuro', trocar_por: 'botao: verde' })
  assert.equal(r.ok, true)
  assert.equal(r.texto, 'linha um\nbotao: verde\nlinha tres')
})

test('trecho que nao existe e recusado', () => {
  const r = aplicarTroca('nada aqui', { procurar: 'trecho inventado', trocar_por: 'x' })
  assert.equal(r.ok, false)
  assert.match(r.erro, /nao achei/)
})

test('trecho repetido e recusado, nao adivinhado', () => {
  // Duas ocorrencias e nao da para saber qual ele queria. Melhor recusar do
  // que trocar a errada e o Paulo descobrir no ar.
  const r = aplicarTroca('cor azul aqui e cor azul ali', {
    procurar: 'cor azul',
    trocar_por: 'cor verde',
  })
  assert.equal(r.ok, false)
  assert.match(r.erro, /2 vezes/)
})

test('nome de ramo sai limpo e carimbado', () => {
  const n = nomearRamo('Ajusta a Videoaula do Parceiro!', new Date('2026-09-18T14:30:00Z'))
  assert.match(n, /^zeus\/ajusta-a-videoaula-do-parceiro-\d+$/)
})

test('dois pedidos iguais no mesmo dia nao colidem', () => {
  const a = nomearRamo('mesmo pedido', new Date('2026-09-18T14:30:00Z'))
  const b = nomearRamo('mesmo pedido', new Date('2026-09-18T15:45:00Z'))
  assert.notEqual(a, b)
})
