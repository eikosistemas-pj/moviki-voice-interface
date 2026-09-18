// servidor/promessa.test.js
//
// A REDE EMBAIXO DA LISTA DE VERBOS.
//
// Se estes testes cairem, o Zeus volta a aceitar ordem, dizer "vou fazer" e
// nao fazer nada — que e a reclamacao que o Paulo repetiu tres vezes no mesmo
// dia, e a que ele mesmo resumiu: "o disparo nao esta pegando".

import test from 'node:test'
import assert from 'node:assert/strict'
import { decidirPromessa } from './promessa.js'

const comToken = (resposta, ordem) => decidirPromessa({ resposta, ordem, temToken: true })

test('o que a lista de verbos nao pega, a promessa pega', () => {
  // "da um jeito naquele rodape" nao tem nenhum verbo da lista de mudanca.
  // Antes disto, sumia na conversa. Agora o proprio Zeus dispara.
  const d = comToken('Pode deixar, vou arrumar o rodape.', 'da um jeito naquele rodape do site')
  assert.equal(d.o, 'disparar')
  assert.equal(d.tipo, 'trabalho')
  assert.equal(d.repo, 'moviki')
})

test('promessa de olhar vira analise, nao Pull Request', () => {
  const d = comToken('Vou conferir o painel do lojista e ja te respondo.', 'e o painel do lojista, ta tudo certo la?')
  assert.equal(d.o, 'disparar')
  assert.equal(d.tipo, 'analise')
  assert.equal(d.repo, 'moviki-app')
})

test('conversa comum continua sendo conversa', () => {
  // A rede nao pode transformar toda resposta em tarefa: o Zeus conversa o dia
  // inteiro, e cada disparo custa dinheiro e abre Pull Request.
  const d = comToken(
    'O painel do lojista mudou essa semana. Entrou uma aba nova de artes.',
    'como esta o painel do lojista'
  )
  assert.equal(d.o, null)
})

test('RECUSA NAO E PROMESSA — e este erro seria o pior de todos', () => {
  // "nao vou mexer no preco" e o Zeus obedecendo a trava. Disparar aqui abriria
  // Pull Request exatamente onde ele acabou de dizer que nao encosta.
  const d = comToken('Isso e seu, nao meu. Nao vou mexer no preco do Premium.', 'sobe o Premium')
  assert.equal(d.o, null)
})

test('a cerca do que nunca e do robo vale tambem no caminho novo', () => {
  // AQUI ESTAVA O BURACO QUE ESTE CONSERTO PODIA ABRIR. O verbo de mudanca nao
  // esta na frase do Paulo (que so perguntou) — esta na resposta do Zeus. Se a
  // cerca dependesse do verbo na frase dele, o caminho novo passaria por baixo.
  const d = comToken('Vou ajustar o Premium para setenta e nove.', 'e o Premium, da para ficar mais caro?')
  assert.equal(d.o, 'vedado')

  const dinheiro = comToken('Vou corrigir isso.', 'aquela comissao do parceiro ta estranha')
  assert.equal(dinheiro.o, 'vedado')
})

test('prometeu sem dizer onde: ele pergunta, em vez de a promessa sumir', () => {
  // Este e o caso que o Paulo vivia sem saber: o Zeus prometia, nao dava para
  // saber em que repositorio mexer, e a ordem morria calada. Agora a pergunta
  // sai na MESMA resposta.
  const d = comToken('Pode deixar, vou arrumar isso.', 'arruma aquilo la que a gente falou')
  assert.equal(d.o, 'faltou_onde')
  assert.equal(d.tipo, 'trabalho')
})

test('sem token ele diz que nao tem as maos, em vez de prometer no vazio', () => {
  const d = decidirPromessa({
    resposta: 'Vou colocar o botao novo.',
    ordem: 'poe um botao novo na pagina principal',
    temToken: false,
  })
  assert.equal(d.o, 'faltou_token')
})

test('sem token ele AINDA consegue olhar: analise nao escreve nada', () => {
  // Analise le o espelho local. Recusar por falta de token seria tirar dele a
  // unica coisa que continua funcionando quando o GitHub cai.
  const d = decidirPromessa({
    resposta: 'Vou dar uma olhada no site.',
    ordem: 'ta acontecendo alguma coisa estranha na pagina principal',
    temToken: false,
  })
  assert.equal(d.o, 'disparar')
  assert.equal(d.tipo, 'analise')
})

test('resposta vazia nao dispara nada', () => {
  assert.equal(comToken('', 'muda o rodape').o, null)
  assert.equal(comToken(null, 'muda o rodape').o, null)
})
