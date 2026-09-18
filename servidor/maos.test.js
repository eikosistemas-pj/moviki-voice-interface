import test from 'node:test'
import assert from 'node:assert/strict'
import { podeMexer, ramoValido, REPOS_PERMITIDOS } from './maos.js'

test('o robo do dinheiro esta fora do alcance', () => {
  // O mapa mestre diz que ele muda o minimo possivel, de proposito. Robo
  // mexendo ali, ainda que por Pull Request, e risco que nao se paga.
  assert.ok(!REPOS_PERMITIDOS.includes('moviki-robo'))
  const r = podeMexer('moviki-robo', 'lib/asaas.js')
  assert.equal(r.permitido, false)
  assert.match(r.motivo, /dinheiro/)
})

test('o Zeus nao mexe em si mesmo', () => {
  const r = podeMexer('moviki-voice-interface', 'servidor/zeus.js')
  assert.equal(r.permitido, false)
  assert.match(r.motivo, /mim mesmo/)
})

test('trabalho normal passa', () => {
  assert.equal(podeMexer('moviki-app', 'index.html').permitido, true)
  assert.equal(podeMexer('moviki', 'src/pagina.jsx').permitido, true)
  assert.equal(podeMexer('moviki-ai', 'lib/promptPainel.js').permitido, true)
})

test('regra de seguranca e intocavel', () => {
  assert.equal(podeMexer('moviki-app', 'firebase/firestore.rules').permitido, false)
  assert.equal(podeMexer('moviki-app', 'qualquer/coisa.rules').permitido, false)
})

test('rotina automatica e segredo sao intocaveis', () => {
  assert.equal(
    podeMexer('moviki-assistente-social', '.github/workflows/feed.yml').permitido,
    false
  )
  assert.equal(podeMexer('moviki-app', '.env.local').permitido, false)
  assert.equal(podeMexer('moviki', 'vercel.json').permitido, false)
})

test('o mapa mestre nao e alterado por robo', () => {
  // Ele se atualiza no mesmo Pull Request da alteracao, pela mao de quem
  // entende a decisao.
  assert.equal(podeMexer('moviki-app', 'CLAUDE.md').permitido, false)
})

test('caminho que sai da pasta e recusado', () => {
  // Um ".." solto alcanca o resto do disco — inclusive /etc/zeus/zeus.env,
  // onde mora a chave da Anthropic.
  assert.equal(podeMexer('moviki-app', '../../etc/zeus/zeus.env').permitido, false)
  assert.equal(podeMexer('moviki-app', '/etc/passwd').permitido, false)
  assert.equal(podeMexer('moviki-app', 'src/../../fora.txt').permitido, false)
})

test('a main nunca e o destino', () => {
  // Regra de ouro numero 1: o Vercel publica a main na hora para os clientes.
  assert.equal(ramoValido('main'), false)
  assert.equal(ramoValido('master'), false)
})

test('toda branch dele se anuncia pelo nome', () => {
  assert.equal(ramoValido('zeus/ajusta-cardapio'), true)
  assert.equal(ramoValido('conserto-rapido'), false, 'sem prefixo nao passa')
})

test('nome de branch estranho e recusado', () => {
  assert.equal(ramoValido('zeus/com espaco'), false)
  assert.equal(ramoValido('zeus/til~aqui'), false)
  assert.equal(ramoValido(''), false)
  assert.equal(ramoValido(null), false)
  assert.equal(ramoValido(`zeus/${'a'.repeat(200)}`), false)
})

test('o motivo da recusa e escrito para ser falado em voz alta', () => {
  const r = podeMexer('moviki-app', 'firebase/firestore.rules')
  assert.ok(r.motivo.length > 10)
  assert.ok(!/[A-Z]{4,}/.test(r.motivo), 'sem grito de maquina')
})
