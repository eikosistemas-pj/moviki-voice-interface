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
const ONDE_MORA = [
  ['moviki-robo', /\b(dinheiro|assinatura|assinaturas|asaas|comissao|comissoes|saque|saques|cobranca|webhook|trial|fatura|inadimplen)/],
  ['moviki-ai', /\b(atendente|atendimento|bot|robo de conversa|caixa de mensagens|vik|whatsapp)/],
  ['moviki-assistente-social', /\b(instagram|facebook|rede social|redes sociais|post|posts|reel|reels|feed|calendario de posts)/],
  ['moviki-app', /\b(painel|lojista|parceiro|videoaula|videoaulas|aula|aulas|cardapio|cadastro|material de apoio|cracha|eikoadm)/],
  ['moviki', /\b(site|vitrine|pagina publica|pagina de venda|landing|seo|sitemap|termos|live publica|mapa de negocios)/],
]

/**
 * De qual repositorio o Paulo esta falando, ou null se nao der para saber.
 *
 * A ordem da lista importa: "o atendente do painel" e do moviki-ai, nao do
 * moviki-app, embora contenha a palavra "painel".
 */
export function repoDoAssunto(frase) {
  const t = normalizar(frase)
  if (!t) return null
  for (const [repo, re] of ONDE_MORA) {
    if (re.test(t)) return repo
  }
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
