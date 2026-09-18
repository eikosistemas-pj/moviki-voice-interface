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

// ---------------------------------------------------------------------------
// O GUARDA-PROMESSA — a rede embaixo da lista de verbos
// ---------------------------------------------------------------------------
//
// O Paulo, tres vezes no mesmo dia: "ele aceita, diz que vai fazer, e daqui a
// dois minutos nao tem nada feito". E o proprio Zeus, para ele: "o disparo nao
// esta pegando".
//
// A lista de verbos conserta as frases que EU consigo imaginar. Estes testes
// guardam a rede que pega o resto: se o Zeus prometeu, virou tarefa.

import { prometeuFazer } from './comando.js'

test('promessa de mexer vira trabalho', () => {
  for (const fala of [
    'Certo. Vou arrumar o rodape agora.',
    'Pode deixar, eu cuido disso.',
    'Vou mexer nisso e te aviso quando terminar.',
    'Ja vou colocar o botao novo.',
    'Deixa comigo. Te conto quando terminar.',
    'Entendi. Vou dar um jeito nisso hoje.',
    'Vou abrir um Pull Request com essa mudanca.',
    'Ja comecei.',
  ]) {
    assert.equal(prometeuFazer(fala), 'trabalho', `nao pegou: "${fala}"`)
  }
})

test('promessa de olhar vira analise, nao Pull Request', () => {
  for (const fala of [
    'Vou olhar o painel agora e ja te respondo.',
    'Vou conferir o codigo do site.',
    'Ja vou dar uma olhada nisso.',
  ]) {
    assert.equal(prometeuFazer(fala), 'analise', `nao pegou: "${fala}"`)
  }
})

test('quem promete olhar E arrumar esta prometendo arrumar', () => {
  // Entregar a coisa maior cobre a menor. O contrario deixaria o Paulo com uma
  // analise quando ele pediu conserto.
  assert.equal(prometeuFazer('Vou olhar o rodape e corrigir o texto.'), 'trabalho')
})

test('NEGACAO NAO E PROMESSA — e este e o erro que custaria caro', () => {
  // "nao vou mexer nisso" e o Zeus RECUSANDO. Disparar aqui abriria Pull
  // Request exatamente onde ele acabou de dizer que nao encosta.
  for (const fala of [
    'Isso e seu, nao meu. Nao vou mexer no preco.',
    'Nao vou alterar nada sem voce confirmar.',
    'Nao vou olhar isso agora.',
  ]) {
    assert.equal(prometeuFazer(fala), null, `disparou numa recusa: "${fala}"`)
  }
})

test('conversa comum nao e promessa', () => {
  for (const fala of [
    'O painel do lojista mudou essa semana. Entrou uma aba nova.',
    'Nao tenho registro disso em andamento. E para comecar agora?',
    'Vou te explicar: o Premium custa setenta e nove reais.',
    'Isso e decisao sua, e voce esta aqui.',
  ]) {
    assert.equal(prometeuFazer(fala), null, `promessa onde nao havia: "${fala}"`)
  }
})

test('a cerca do assunto vedado fecha tambem sem verbo na frase do Paulo', () => {
  // ESTE E O BURACO QUE O CAMINHO NOVO ABRIRIA. Quem disse "vou ajustar" foi o
  // ZEUS, entao o verbo de mudanca nao esta na frase do Paulo — e a cerca do
  // preco e do dinheiro nao pode depender disso para existir.
  assert.equal(assuntoVedado('e o Premium, da para ficar mais caro?'), null)
  assert.equal(
    assuntoVedado('e o Premium, da para ficar mais caro?', { exigeVerbo: false }),
    'preco'
  )
  assert.equal(
    assuntoVedado('aquela comissao do parceiro ta estranha', { exigeVerbo: false }),
    'dinheiro'
  )
  // E o caminho antigo continua igual: conversa sobre preco segue livre.
  assert.equal(assuntoVedado('quanto custa o Premium hoje'), null)
})
