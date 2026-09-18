import test from 'node:test'
import assert from 'node:assert/strict'
import { pareceAnalise, pareceBusca, pareceTrabalho, repoDoAssunto } from './comando.js'
import { ferramentaDeBusca } from './busca.js'
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

// ---------------------------------------------------------------------------
// ONDE O PAULO ESTA FALANDO
// ---------------------------------------------------------------------------
//
// 18/09/2026: ele pediu "muda a cor do BOTAO da newsletter na pagina principal
// da empresa". O Zeus foi procurar newsletter no repositorio do ATENDENTE DO
// WHATSAPP, nao achou, e desistiu dizendo que a newsletter nao existia.
//
// Causa: a expressao do moviki-ai abria com \b e nao fechava, entao "bot"
// casava dentro de "BOTao". Dois caracteres de expressao regular custaram uma
// tarefa inteira.

test('"botao" nunca mais cai no atendente do WhatsApp', () => {
  assert.equal(
    repoDoAssunto('muda a cor do botao da newsletter na pagina principal da empresa'),
    'moviki'
  )
  assert.equal(repoDoAssunto('muda a cor do botao do painel do lojista'), 'moviki-app')
  assert.equal(repoDoAssunto('muda o botao do site'), 'moviki')
  // E o atendente de verdade continua sendo o atendente.
  assert.equal(repoDoAssunto('muda a resposta do bot'), 'moviki-ai')
  assert.equal(repoDoAssunto('muda o texto do atendente'), 'moviki-ai')
})

test('o Paulo fala do site como dono, nao como programador', () => {
  for (const f of [
    'muda o rodape do site',
    'altera a home da empresa',
    'muda a pagina principal',
    'muda o texto da newsletter',
    'altera a pagina da empresa',
  ]) {
    assert.equal(repoDoAssunto(f), 'moviki', `"${f}" devia ser o site`)
  }
})

test('cada repositorio continua achando o que e dele', () => {
  const casos = [
    ['muda o texto do painel do lojista', 'moviki-app'],
    ['muda o cardapio', 'moviki-app'],
    ['muda o material de apoio do parceiro', 'moviki-app'],
    ['muda a comissao', 'moviki-robo'],
    ['muda o aviso de inadimplencia', 'moviki-robo'],
    ['muda o post do instagram', 'moviki-assistente-social'],
  ]
  for (const [f, esp] of casos) assert.equal(repoDoAssunto(f), esp, f)
})

test('sem saber onde e, ele continua devolvendo null e perguntando', () => {
  // Chutar o repositorio seria pior: Pull Request no lugar errado que o Paulo
  // tem que ler para descobrir que esta errado.
  assert.equal(repoDoAssunto('muda aquilo la'), null)
  assert.equal(repoDoAssunto('arruma aquele negocio'), null)
})

test('a pergunta do trabalho e falada, nao vira "nao deu" seco', () => {
  // Era o ida-e-volta que devolvia para o Paulo o trabalho de lembrar.
  const fala = fraseDeAviso({
    ok: false,
    ordem: 'muda a cor do botao da newsletter',
    pergunta: 'Paulo, nao achei nenhuma newsletter no site. Voce quer dizer o formulario de contato do rodape?',
    erros: ['...'],
  })
  assert.match(fala, /nao achei nenhuma newsletter/)
  assert.doesNotMatch(fala, /Nao consegui fazer/)
})

// ---------------------------------------------------------------------------
// O PAULO CHAMA OS REPOSITORIOS PELO NOME
// ---------------------------------------------------------------------------
//
// 18/09/2026: ele pediu "analise o repositorio Moviki App" e o Zeus respondeu
// que nao conseguia analisar de verdade, que a ferramenta de leitura estava
// fora. A ferramenta estava inteira — o pedido nunca chegou nela, porque a
// tabela de roteamento so conhecia palavras de negocio ("painel", "lojista") e
// nao conhecia o NOME dos proprios repositorios.
//
// Perder a ordem por nao reconhecer o nome da coisa e o tipo de defeito que
// faz o dono desistir de pedir.

test('o repositorio chamado pelo nome e reconhecido', () => {
  assert.equal(repoDoAssunto('analisar o repositorio Moviki App'), 'moviki-app')
  assert.equal(repoDoAssunto('analise o moviki-app'), 'moviki-app')
  assert.equal(repoDoAssunto('da uma olhada no moviki ai'), 'moviki-ai')
  assert.equal(repoDoAssunto('olha o moviki assistente social'), 'moviki-assistente-social')
  assert.equal(repoDoAssunto('analise o repositorio moviki'), 'moviki')
})

test('a transcricao de voz erra o nome, e isso e previsto', () => {
  // Falando, "moviki" chega como "movic", "movik", "moviqui". Exigir a grafia
  // exata seria exigir que ele digitasse.
  for (const f of ['analise o movic app', 'analise o movik app', 'analise o moviqui app']) {
    assert.equal(repoDoAssunto(f), 'moviki-app', f)
  }
})

test('nome proprio ganha de palavra de negocio', () => {
  // "o painel do moviki ai" e do atendente: o nome e mais especifico que o
  // assunto.
  assert.equal(repoDoAssunto('o painel do moviki ai'), 'moviki-ai')
})

test('os proibidos sao reconhecidos pelo nome, para a recusa ser a certa', () => {
  // Estar na lista mesmo estando fora do alcance e o que faz a resposta ser
  // "nao encosto nisso" em vez do vago "nao entendi onde e".
  assert.equal(repoDoAssunto('analise o moviki robo'), 'moviki-robo')
  assert.equal(repoDoAssunto('analise o moviki voice interface'), 'moviki-voice-interface')
})

// ---------------------------------------------------------------------------
// OLHAR PARA FORA — pesquisa na internet
// ---------------------------------------------------------------------------
//
// "Voce precisa dar a ele informacoes para que ele pesquise na internet
// tambem, para ficar mais inteligente." — Paulo, 18/09/2026.
//
// Ate entao o Zeus so enxergava para DENTRO: mapa, retrato, codigo. Tudo o que
// estava fora disso ele respondia com o que aprendeu no treino — que tem data
// de validade, e ele nao sabe qual parte esta velha.

test('pedido de internet vira busca, nao varredura de codigo', () => {
  for (const f of [
    'pesquisa na internet quanto custa a Hetzner',
    'da uma pesquisada sobre isso',
    'quem sao meus concorrentes hoje em dia',
  ]) {
    assert.equal(pareceBusca(f), true, f)
  }
})

test('"no google" ganha ate quando a frase tem palavra do Moviki', () => {
  // "procura no google o que mudou no WhatsApp" fala de WhatsApp, que e palavra
  // do repositorio do atendente. Mas ninguem procura no Google dentro do
  // proprio codigo.
  assert.equal(pareceBusca('procura no google o que mudou no WhatsApp Business'), true)
})

test('sinal fraco perde quando ele nomeia uma parte do Moviki', () => {
  // "mercado" pode ser mercado de verdade ou a pagina de mercado do painel.
  assert.equal(pareceBusca('como esta o mercado do painel do lojista'), false)
})

test('ordem de mexer no codigo nunca vira busca', () => {
  assert.equal(pareceBusca('muda a cor do botao do site'), false)
  assert.equal(pareceBusca('analise o repositorio Moviki App'), false)
})

test('a ferramenta de busca muda de nome conforme o modelo', () => {
  // Mandar a versao errada faz a API recusar o pedido inteiro — mesmo defeito
  // que o `effort` no Haiku causou: o Zeus fica sem resposta nenhuma.
  assert.equal(ferramentaDeBusca('claude-opus-5').type, 'web_search_20260209')
  assert.equal(ferramentaDeBusca('claude-sonnet-5').type, 'web_search_20260209')
  assert.equal(ferramentaDeBusca('claude-haiku-4-5').type, 'web_search_20250305')
  assert.equal(ferramentaDeBusca('').type, 'web_search_20250305')
})

test('toda busca tem teto de quantas vezes procura', () => {
  // Cada busca e paga. Sem teto, uma pergunta vaga viraria dez buscas atras de
  // uma resposta que nao existe.
  assert.ok(ferramentaDeBusca('claude-opus-5').max_uses > 0)
})
