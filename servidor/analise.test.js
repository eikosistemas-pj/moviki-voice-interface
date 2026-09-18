import test from 'node:test'
import assert from 'node:assert/strict'
import { pareceAnalise, pareceTrabalho, repoDoAssunto } from './comando.js'
import { fraseDeAviso } from './aviso.js'

// ---------------------------------------------------------------------------
// O CAMINHO DE OLHAR O CODIGO
// ---------------------------------------------------------------------------
//
// 18/09/2026: o Paulo pediu "analise o painel do parceiro" e nao aconteceu
// nada — nem trabalho, nem resposta. So existiam dois caminhos: ordem com
// verbo de mudanca virava Pull Request, e todo o resto virava conversa, onde
// o Zeus nao ve o codigo. Perguntar era a unica coisa que ele nao sabia fazer.

test('o pedido que ficou sem resposta hoje agora tem caminho', () => {
  assert.equal(pareceAnalise('analise o painel do parceiro'), true)
  assert.equal(repoDoAssunto('analise o painel do parceiro'), 'moviki-app')
})

test('pedir olhada nao abre Pull Request', () => {
  // Errar para o lado do trabalho aqui seria abrir Pull Request que ninguem
  // pediu — que e pior que nao fazer nada.
  for (const f of [
    'analise o painel do parceiro',
    'da uma olhada no site',
    'verifica se tem algum problema no atendente',
    'confere o painel do lojista',
  ]) {
    assert.equal(pareceTrabalho(f), false, `"${f}" nao podia virar trabalho`)
    assert.equal(pareceAnalise(f), true, `"${f}" devia virar analise`)
  }
})

test('ordem de mexer continua sendo trabalho, nao analise', () => {
  // Verbo de mudanca ganha: "muda a cor depois de conferir" e ordem de mexer.
  for (const f of [
    'muda a cor do botao do painel',
    'altera o texto do site',
    'confere e muda o rodape do painel',
  ]) {
    assert.equal(pareceTrabalho(f), true, `"${f}" devia ser trabalho`)
    assert.equal(pareceAnalise(f), false, `"${f}" nao podia virar analise`)
  }
})

test('conversa comum nao vira analise', () => {
  for (const f of ['bom dia', 'quanto custa o Premium', 'quem cuida do dinheiro']) {
    assert.equal(pareceAnalise(f), false, `"${f}" nao podia virar analise`)
  }
})

test('o aviso da analise E a resposta, nao um anuncio', () => {
  // Dizer "terminei a analise, me pergunte de novo" obrigaria o Paulo a pedir
  // duas vezes a mesma coisa.
  const fala = fraseDeAviso({
    tipo: 'analise',
    ok: true,
    ordem: 'analise o painel do parceiro',
    resposta: 'O painel esta carregando tres vezes a mesma lista de artes.',
  })
  assert.equal(fala, 'O painel esta carregando tres vezes a mesma lista de artes.')
})

test('analise que falhou conta o motivo', () => {
  const fala = fraseDeAviso({
    tipo: 'analise',
    ok: false,
    ordem: 'analise o painel',
    erros: ['olhei por 5 minutos e nao fechei uma resposta'],
  })
  assert.match(fala, /nao consegui fechar uma resposta/)
  assert.match(fala, /5 minutos/)
})

test('o aviso de trabalho continua falando de Pull Request', () => {
  const fala = fraseDeAviso({ ok: true, ordem: 'muda a cor', link: 'https://x' })
  assert.match(fala, /Pull Request/)
})
