// servidor/comando.js  (repo: moviki-voice-interface)
//
// O QUE O PAULO QUIS DIZER.
//
// O Zeus so ouve texto: o navegador transcreve a fala e manda a frase. Este
// modulo le a frase e separa tres coisas:
//
//   "Zeus, assuma daqui"        -> abrir o turno   (ele decide no lugar dele)
//   "Zeus, acabei de chegar"    -> fechar o turno  (o Paulo voltou)
//   qualquer outra coisa        -> trabalho        (ordem direta)
//
// POR QUE ISSO E DELICADO
// Abrir turno e o comando mais perigoso do sistema. Um falso positivo aqui
// entrega o comando da empresa a um robo porque o Paulo falou uma palavra
// parecida. Por isso o fechamento e conferido ANTES da abertura: "eu assumo
// daqui" e o Paulo retomando, nao mandando o Zeus assumir — e as duas frases
// carregam a mesma raiz "assum". Invertida a ordem, o Zeus assumiria
// exatamente na hora em que o Paulo disse que estava voltando.
//
// A transcricao do navegador varia em acento e pontuacao, entao tudo e
// comparado sem acento e em caixa baixa — mesma tecnica do lib/humor.js.

import { PEDIDOS } from '../lib/turno.js'

/** Remove acentos e baixa a caixa. */
function normalizar(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * O Paulo voltou. Vem primeiro de proposito (ver cabecalho).
 *
 * "eu assumo daqui" e "assumo o comando" sao ele retomando o posto — a forma
 * na primeira pessoa e o sinal.
 */
const VOLTEI = [
  /\bacabei de chegar\b/,
  /\bcheguei\b/,
  /\bvoltei\b/,
  /\b(estou|to) de volta\b/,
  /\beu assumo\b/,
  /\bassumo daqui\b/,
  /\bassumo o comando\b/,
  /\bpode parar\b/,
  /\bpode descansar\b/,
  /\bencerra(r)? o turno\b/,
]

/**
 * O Paulo esta saindo e passando o posto.
 *
 * So as formas imperativas — "assuma", "assume", "assumir". A primeira pessoa
 * ("assumo") ja foi capturada acima como retomada.
 */
const ASSUMA = /\bassum(a|e|ir)\b/

/** Negacao antes do verbo: "nao assuma nada por enquanto". */
const NEGADO = /\b(nao|nunca|jamais)\b[^.]{0,20}\bassum(a|e|ir)\b/

export function entender(frase) {
  const t = normalizar(frase)

  if (!t) return { tipo: null, motivo: 'frase_vazia' }

  for (const re of VOLTEI) {
    if (re.test(t)) return { tipo: PEDIDOS.FECHAR_TURNO, motivo: 'paulo_voltou' }
  }

  if (ASSUMA.test(t)) {
    if (NEGADO.test(t)) {
      return { tipo: PEDIDOS.EXECUTAR, motivo: 'assumir_negado' }
    }
    return { tipo: PEDIDOS.ABRIR_TURNO, motivo: 'paulo_passou_o_posto' }
  }

  // Todo o resto e trabalho. Nao e o Zeus que decide se aquilo e "decisao":
  // quem decide isso e a trava, com o assunto em maos.
  return {
    tipo: PEDIDOS.EXECUTAR,
    motivo: 'ordem_de_trabalho',
    assunto: assuntoVedado(frase),
  }
}

// ---------------------------------------------------------------------------
// QUAL E O ASSUNTO — e se ele e dos que nunca sao do robo.
// ---------------------------------------------------------------------------
//
// A lista NUNCA_SOZINHO de lib/turno.js so vale se alguem disser qual e o
// assunto. Ninguem diz: o Paulo fala uma frase solta e pronto. Sem esta
// leitura, a parte mais importante da trava fica de enfeite, e o unico freio
// seria pedir bonzinho ao modelo no prompt — que e pedido, nao trava.
//
// A REGRA: assunto proibido + VERBO DE MUDANCA = negado.
//
// Falar sobre preco e livre; MEXER no preco nao e. "Quanto custa o Premium?"
// o Zeus responde. "Sobe o Premium para setenta e nove" ele recusa. Sem essa
// separacao, o Zeus ficaria mudo sobre metade da empresa — e trava que
// atrapalha o dono vira trava que o dono manda tirar.

/** Verbos que mudam o mundo. Perguntar nao esta aqui, de proposito. */
const VERBO_DE_MUDANCA =
  /\b(aprova|aprovar|aprove|junta|juntar|mescla|mesclar|merge|sobe|subir|publica|publicar|posta|postar|muda|mudar|mude|altera|alterar|troca|trocar|aumenta|aumentar|reduz|reduzir|baixa|baixar|apaga|apagar|apague|deleta|deletar|remove|remover|cancela|cancelar|paga|pagar|transfere|transferir|libera|liberar|desliga|desligar|reajusta|reajustar|zera|zerar|derruba|derrubar)\b/

const ASSUNTOS = [
  // O PROPRIO ZEUS vem primeiro: "muda a trava" e sobre ele mesmo, nao sobre
  // a seguranca do Moviki.
  //
  // De proposito NAO basta a palavra "zeus" para cair aqui: o Paulo chama ele
  // pelo nome o tempo todo ("Zeus, muda o texto do site"), e um vocativo nao
  // pode virar assunto proibido. O que marca sao as tripas dele.
  [
    'o_proprio_zeus',
    /\b(trava|turno|voce mesmo|si mesmo|seu codigo|proprio codigo|seu prompt|sua instrucao|seu servidor|servidor do zeus|cerebro do zeus|vps|systemd|nginx|zeus-cerebro|sua chave|seu token)\b/,
  ],
  ['aprovar_pr', /\b(pull request|pull requests|\bpr\b|merge|main|producao)\b/],
  // Os nomes dos planos entram porque o Paulo fala "sobe o Premium", nao
  // "sobe o preco do plano Premium". "Pro" sozinho fica de fora de
  // proposito: em fala corrente "pro" e "para o" — "muda pro azul" nao
  // pode virar mexida em preco.
  ['preco', /\b(preco|precos|plano|planos|mensalidade|anuidade|assinatura|desconto|reajuste|valor|premium|enterprise|basico)\b|\bplano pro\b/],
  ['dinheiro', /\b(asaas|comissao|comissoes|saque|saques|cobranca|cobrancas|estorno|reembolso|fatura|pix|repasse)\b/],
  ['seguranca', /\b(firestore|storage|regra|regras|permissao|permissoes|lgpd|acesso)\b/],
  ['segredo', /\b(chave|chaves|token|senha|senhas|api key|secret|variavel de ambiente)\b/],
  ['publicar', /\b(instagram|facebook|post|posts|reel|reels|feed|rede social|redes sociais)\b/],
  ['apagar', /\b(repositorio|colecao|banco|conta|backup)\b/],
]

// ---------------------------------------------------------------------------
// EM QUE REPOSITORIO O PAULO ESTA FALANDO
// ---------------------------------------------------------------------------
//
// Ele nao diz "moviki-app": ele diz "o painel do lojista". A ligacao entre o
// que ele fala e onde o codigo mora esta no mapa mestre, e aqui vira lista.
//
// Sem isso, o Zeus teria que perguntar "em qual repositorio?" a cada ordem —
// e assistente que devolve pergunta de programador nao serve ao Paulo.
//
// `moviki-robo` esta na lista DE PROPOSITO, mesmo estando fora do alcance
// dele: assim, pedir mexida no dinheiro recebe a recusa certa ("nao encosto
// no robo do dinheiro") em vez do vago "nao entendi onde e".
// TODA ENTRADA AQUI FECHA COM \b, E ISSO NAO E DETALHE — 18/09/2026.
//
// As expressoes antigas abriam com \b e NAO fechavam. Resultado: "bot"
// (do atendente) casava dentro de "BOTao".
//
// O Paulo pediu "muda a cor do BOTAO da newsletter na pagina principal" e o
// Zeus foi procurar newsletter no repositorio do ATENDENTE DO WHATSAPP. Nao
// achou, claro, e desistiu dizendo que a newsletter nao existia.
//
// Uma tarefa inteira perdida por dois caracteres de expressao regular. Onde a
// intencao e mesmo casar um PREFIXO (inadimplen -> inadimplente,
// inadimplencia), isso fica separado e comentado.
const ONDE_MORA = [
  [
    'moviki-robo',
    /\b(dinheiro|asaas|comissao|comissoes|saque|saques|cobranca|cobrancas|webhook|trial|fatura|faturas|assinatura|assinaturas|estorno|reembolso|repasse)\b/,
  ],
  // Prefixo de proposito: inadimplente, inadimplencia.
  ['moviki-robo', /\binadimplen/],

  [
    'moviki-ai',
    /\b(atendente|atendentes|atendimento|bot|bots|chatbot|vik|whatsapp|zap)\b|\b(robo de conversa|caixa de mensagens)\b/,
  ],

  [
    'moviki-assistente-social',
    /\b(instagram|facebook|post|posts|postagem|postagens|reel|reels|feed)\b|\b(rede social|redes sociais|calendario de posts)\b/,
  ],

  [
    'moviki-app',
    /\b(painel|paineis|lojista|lojistas|parceiro|parceiros|videoaula|videoaulas|aula|aulas|cardapio|cardapios|cadastro|cadastros|cracha|crachas|eikoadm)\b|\b(material de apoio)\b/,
  ],

  // O SITE PUBLICO. A lista estava curta demais: o Paulo falou "pagina
  // principal da empresa" e nada casava — nem "pagina principal", nem
  // "empresa", nem "newsletter". Ele fala do site como um dono fala: "a
  // pagina da empresa", "a home", "o topo do site".
  [
    'moviki',
    /\b(site|vitrine|landing|home|homepage|newsletter|seo|sitemap|termos|privacidade|institucional)\b|\b(pagina publica|pagina principal|pagina inicial|pagina da empresa|pagina de venda|live publica|mapa de negocios)\b/,
  ],
]

/**
 * Ultimo recurso: palavras genericas que so podem ser o site publico.
 *
 * Fica separado e roda DEPOIS de tudo, porque "a pagina da empresa" e vago o
 * bastante para atropelar os especificos se estivesse na lista principal. Mas
 * devolver o site e melhor que devolver nada: errar aqui custa um Pull Request
 * no lugar errado, que ele recusa; nao errar custa a ordem inteira.
 */
const SO_PODE_SER_O_SITE = /\b(da empresa|do moviki|rodape|cabecalho|topo do site|menu do site|banner)/

export function repoDoAssunto(frase) {
  const t = normalizar(frase)
  if (!t) return null
  for (const [repo, re] of ONDE_MORA) {
    if (re.test(t)) return repo
  }
  if (SO_PODE_SER_O_SITE.test(t)) return 'moviki'
  return null
}

/**
 * A frase e uma ordem de TRABALHO (mexer no codigo) ou so conversa?
 *
 * Trabalho exige verbo de mudanca. "Como esta o painel?" e conversa; "muda o
 * texto do painel" e trabalho. Errar para o lado da conversa nao custa nada
 * — o Paulo repete com outras palavras. Errar para o lado do trabalho abre
 * Pull Request que ninguem pediu.
 */
export function pareceTrabalho(frase) {
  const t = normalizar(frase)
  return Boolean(t) && VERBO_DE_MUDANCA.test(t)
}

/**
 * PEDIDO DE OLHAR O CODIGO E RESPONDER — sem mexer em nada.
 *
 * O BURACO QUE ISTO FECHA — 18/09/2026
 * O Paulo pediu "analise o painel do parceiro" e nao aconteceu nada. So havia
 * dois caminhos: ordem com verbo de mudanca virava Pull Request, e todo o
 * resto virava conversa — e na conversa o Zeus nao ve o codigo, so o retrato.
 *
 * Perguntar "o que tem de errado no painel?" era a unica coisa que ele nao
 * conseguia fazer: a mais barata, a mais segura, e a que o Paulo mais pede.
 *
 * ISTO NAO E UMA CERCA, E UM ATALHO. Falso negativo aqui nao quebra nada: a
 * frase cai na conversa, como caia antes. Por isso a lista pode ser generosa.
 */
const VERBO_DE_ANALISE =
  /\b(analisa|analise|analisar|examina|examinar|avalia|avaliar|revisa|revisar|confere|conferir|verifica|verificar|checa|checar|investiga|investigar|diagnostica|diagnosticar|audita|auditar|inspeciona|inspecionar|procura|procurar|acha|achar|encontra|encontrar|descobre|descobrir|entende|entender|explica|explicar)\b/

/** Jeitos de perguntar que nao tem verbo nenhum, mas sao pedido de olhada. */
const PERGUNTA_DE_CODIGO = [
  /\bda uma olhada\b/,
  /\bde uma olhada\b/,
  /\bolha (o|a|no|na|pra|para)\b/,
  /\bda uma conferida\b/,
  /\bcomo (esta|anda|ta) (o|a)\b/,
  /\bo que (tem|ha|tem de) (errado|de errado|de problema)\b/,
  /\btem (algum|algo) (problema|erro|bug)\b/,
  /\bo que (da|daria) para melhorar\b/,
  /\bque que (tem|ta) (errado|acontecendo)\b/,
]

export function pareceAnalise(frase) {
  const t = normalizar(frase)
  if (!t) return false
  // Verbo de mudanca ganha: "muda a cor depois de conferir" e ordem de mexer,
  // nao pedido de olhada. Errar para o lado do trabalho aqui seria abrir Pull
  // Request que ninguem pediu, entao quem decide antes e o pareceTrabalho.
  if (VERBO_DE_MUDANCA.test(t)) return false
  if (VERBO_DE_ANALISE.test(t)) return true
  return PERGUNTA_DE_CODIGO.some((re) => re.test(t))
}

/**
 * Devolve o assunto vedado da frase, ou null.
 *
 * Null aqui nao quer dizer "pode tudo": quer dizer que a frase nao caiu em
 * nenhuma das portas fechadas. Quem decide o resto continua sendo a trava.
 */
export function assuntoVedado(frase) {
  const t = normalizar(frase)
  if (!t) return null

  // Sem verbo de mudanca e conversa, nao ordem. Conversa e livre.
  if (!VERBO_DE_MUDANCA.test(t)) return null

  for (const [nome, re] of ASSUNTOS) {
    if (re.test(t)) return nome
  }

  // Mandou apagar/derrubar alguma coisa sem dizer o que. Na duvida, e do
  // Paulo: apagar e o unico verbo aqui que nao tem volta.
  if (/\b(apaga|apagar|apague|deleta|deletar|derruba|derrubar)\b/.test(t)) {
    return 'apagar'
  }

  return null
}
