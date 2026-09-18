// servidor/comando.test.js
//
// O teste que importa aqui e o do falso positivo: o Zeus nao pode assumir
// porque o Paulo falou uma palavra parecida.

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  assuntoVedado,
  entender,
  pareceTrabalho,
  repoDoAssunto,
} from './comando.js'
import { NUNCA_SOZINHO, PEDIDOS } from '../lib/turno.js'

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

// --- O Zeus nao mexe em si mesmo ------------------------------------------
// A porta que nao pode ser trancada por dentro: sem isso, uma decisao infeliz
// no turno aberto fecharia o robo e ninguem mais entraria para consertar.

test('mandar o Zeus mexer nele mesmo e barrado', () => {
  assert.equal(assuntoVedado('muda a trava do turno'), 'o_proprio_zeus')
  assert.equal(assuntoVedado('altera o seu codigo'), 'o_proprio_zeus')
  assert.equal(assuntoVedado('troca o seu prompt'), 'o_proprio_zeus')
  assert.equal(assuntoVedado('desliga o zeus-cerebro'), 'o_proprio_zeus')
  assert.equal(assuntoVedado('muda a sua chave'), 'o_proprio_zeus')
  assert.equal(assuntoVedado('altera o nginx da vps'), 'o_proprio_zeus')
})

test('chamar o Zeus pelo nome NAO vira assunto proibido', () => {
  // O Paulo fala com ele pelo nome o tempo todo. Vocativo nao e assunto — se
  // virasse, o Zeus recusaria metade das ordens dele.
  assert.equal(assuntoVedado('Zeus, muda o texto da pagina de venda'), null)
  assert.equal(assuntoVedado('Zeus, altera a videoaula da live'), null)
})

test('o proprio Zeus esta na lista que nunca e do robo', () => {
  assert.ok(NUNCA_SOZINHO.includes('o_proprio_zeus'))
})

// --- Em que repositorio o Paulo esta falando ------------------------------

test('reconhece o repositorio pelo que o Paulo fala', () => {
  // Ele nao diz "moviki-app": ele diz "o painel do lojista".
  assert.equal(repoDoAssunto('muda o texto do painel do lojista'), 'moviki-app')
  assert.equal(repoDoAssunto('ajusta a videoaula'), 'moviki-app')
  assert.equal(repoDoAssunto('muda a pagina de venda do site'), 'moviki')
  assert.equal(repoDoAssunto('altera o post do instagram'), 'moviki-assistente-social')
  assert.equal(repoDoAssunto('muda o tom do atendente'), 'moviki-ai')
})

test('o atendente do painel e do moviki-ai, nao do moviki-app', () => {
  // A ordem da lista existe por isto: a frase tem "painel" dentro.
  assert.equal(repoDoAssunto('muda o atendente da caixa de mensagens do painel'), 'moviki-ai')
})

test('assunto de dinheiro aponta para o robo — para a recusa ser a certa', () => {
  // Ele esta fora do alcance do Zeus, mas precisa ser RECONHECIDO: assim a
  // resposta e "nao encosto no robo do dinheiro" em vez de "nao entendi".
  assert.equal(repoDoAssunto('muda a comissao do parceiro'), 'moviki-robo')
  assert.equal(repoDoAssunto('mexe no webhook do asaas'), 'moviki-robo')
})

test('frase sem pista nao chuta repositorio', () => {
  assert.equal(repoDoAssunto('muda aquilo la'), null)
  assert.equal(repoDoAssunto(''), null)
})

test('so e trabalho quando tem verbo de mudanca', () => {
  // Errar para o lado da conversa nao custa nada — o Paulo repete. Errar para
  // o lado do trabalho abre Pull Request que ninguem pediu.
  assert.equal(pareceTrabalho('como esta o painel do lojista'), false)
  assert.equal(pareceTrabalho('me fala das videoaulas'), false)
  assert.equal(pareceTrabalho('muda o texto do painel'), true)
  assert.equal(pareceTrabalho('altera a videoaula'), true)
})
