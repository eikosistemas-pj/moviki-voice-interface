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

/**
 * VERBOS QUE MUDAM O MUNDO. Perguntar nao esta aqui, de proposito.
 *
 * ---------------------------------------------------------------------------
 * A LISTA ESTAVA CURTA, E ERA POR ISSO QUE ELE NAO EXECUTAVA — 18/09/2026
 * ---------------------------------------------------------------------------
 * O Paulo: *"cada tarefa que e pedida a ele nao esta virando tarefa na cabeca
 * dele. Ela nao se torna uma ordem. Ele escuta, aceita, mas nao executa."*
 *
 * Estava certo, e a causa era esta lista. Ela tinha "muda", "altera", "troca" —
 * e faltava quase tudo que uma pessoa diz de verdade quando manda fazer algo:
 *
 *     "arruma isso"        "coloca um botao ali"
 *     "cria uma aba"       "poe o texto novo"
 *     "conserta o rodape"  "acrescenta o link"
 *     "faz isso pra mim"   "resolve esse problema"
 *
 * Nenhum desses casava. Sem verbo de mudanca, `pareceTrabalho` dava falso, o
 * pedido caia na CONVERSA — e na conversa o Zeus responde bonito, concorda, e
 * nao abre Pull Request nenhum. Do lado de ca: ele escuta, aceita e nao faz.
 *
 * ERRAR PARA QUE LADO CUSTA MENOS
 * Falso positivo aqui abre um Pull Request que o Paulo recusa — aborrecimento
 * de um minuto. Falso negativo faz a ordem sumir sem ninguem perceber, e o
 * Paulo descobre horas depois que nada aconteceu. A lista deve ser GENEROSA.
 *
 * Perguntar continua fora: "como esta o painel?" e conversa, e "o que voce acha
 * de mudar a cor?" tambem — a duvida ali e sobre a ideia, nao sobre o fazer.
 */
const VERBO_DE_MUDANCA = new RegExp(
  '\\b(?:' +
    [
      // --- os que ja existiam --------------------------------------------
      'aprova|aprovar|aprove|junta|juntar|junte|mescla|mesclar|merge',
      'sobe|subir|suba|publica|publicar|publique|posta|postar|poste',
      'muda|mudar|mude|altera|alterar|altere|troca|trocar|troque',
      'aumenta|aumentar|aumente|reduz|reduzir|reduza|baixa|baixar|baixe',
      'apaga|apagar|apague|deleta|deletar|delete|remove|remover|remova',
      'cancela|cancelar|cancele|paga|pagar|pague',
      'transfere|transferir|transfira|libera|liberar|libere',
      'desliga|desligar|desligue|reajusta|reajustar|reajuste',
      'zera|zerar|zere|derruba|derrubar|derrube',

      // --- OS QUE FALTAVAM, e que sao os que ele mais usa ------------------
      // "arruma isso", "conserta o rodape", "corrige o texto"
      'arruma|arrumar|arrume|conserta|consertar|conserte',
      'corrige|corrigir|corrija|ajusta|ajustar|ajuste',
      // "coloca um botao", "poe o texto novo", "bota ali"
      'coloca|colocar|coloque|poe|poem|por|ponha|bota|botar|bote',
      // "cria uma aba", "faz isso", "monta a tela"
      'cria|criar|crie|faz|faca|fazer|monta|montar|monte',
      'gera|gerar|gere|constroi|construir|construa',
      // "acrescenta o link", "adiciona um campo", "inclui isso"
      'acrescenta|acrescentar|acrescente|adiciona|adicionar|adicione',
      'inclui|incluir|inclua|insere|inserir|insira',
      // "tira aquilo", "esconde o aviso", "some com isso"
      'tira|tirar|tire|retira|retirar|retire|esconde|esconder|esconda',
      // "melhora isso", "refaz", "reescreve", "resolve"
      'melhora|melhorar|melhore|refaz|refazer|refaca',
      'reescreve|reescrever|reescreva|resolve|resolver|resolva',
      'implementa|implementar|implemente|aplica|aplicar|aplique',
      // "renomeia", "move", "organiza", "atualiza"
      'renomeia|renomear|renomeie|move|mover|mova',
      'organiza|organizar|organize|atualiza|atualizar|atualize',
      'instala|instalar|instale|configura|configurar|configure',
      'ativa|ativar|ative|liga|ligar|ligue|habilita|habilitar|habilite',
      'desativa|desativar|desative|desabilita|desabilitar|desabilite',
      // "duplica", "copia pra la", "substitui"
      'duplica|duplicar|duplique|substitui|substituir|substitua',
      'padroniza|padronizar|padronize|renova|renovar|renove',
    ].join('|') +
    ')\\b'
)

/**
 * "Quero que voce...", "preciso que voce...", "pode fazer..." — pedido educado.
 *
 * O Paulo nem sempre usa imperativo. "Eu queria que o botao fosse verde" e uma
 * ordem tanto quanto "muda o botao para verde" — e a primeira nao tem nenhum
 * verbo da lista acima na forma que ela casa.
 */
const PEDIDO_EDUCADO =
  /\b(quero que|queria que|preciso que|precisava que|gostaria que|pode(ria)? (voce )?(fazer|mudar|colocar|criar|arrumar|ajustar|corrigir)|da para (voce )?(fazer|mudar|colocar|criar|arrumar)|seria bom (se|que)|tem que (ser|ficar|virar)|deixa (ele|isso|a|o) )/

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
// ---------------------------------------------------------------------------
// O PAULO TAMBEM CHAMA OS REPOSITORIOS PELO NOME. ISSO FALTAVA.
// ---------------------------------------------------------------------------
// 18/09/2026: ele pediu "analise o repositorio Moviki App" e o Zeus respondeu
// que nao conseguia analisar de verdade. Nao era a ferramenta de leitura: e
// que a lista abaixo so conhecia PALAVRAS DE NEGOCIO ("painel", "lojista") e
// nao conhecia os nomes dos proprios repositorios. Sem repositorio
// identificado, o pedido nem chegava a abrir os olhos — caia na conversa, que
// so tem o retrato.
//
// Perder a ordem por nao reconhecer o nome da coisa e o tipo de defeito que
// faz o dono desistir de pedir.
//
// A GRAFIA VEM DA TRANSCRICAO DE VOZ, NAO DO TECLADO. Falando, "moviki" chega
// como "movic", "movik", "moviqui". Por isso o nome aceita variacao — e por
// isso esta lista roda ANTES da de palavras de negocio: nome proprio e mais
// especifico que assunto.
const NOME = '(?:moviki|movike|moviqui|movik|movic)'

const REPO_POR_NOME = [
  ['moviki-app', new RegExp(`\\b${NOME}[\\s\\-]?(app|aplicativo|painel)\\b`)],
  ['moviki-ai', new RegExp(`\\b${NOME}[\\s\\-]?(ai|i\\.?a\\.?|atendente)\\b`)],
  ['moviki-robo', new RegExp(`\\b${NOME}[\\s\\-]?(robo|robot)\\b`)],
  ['moviki-assistente-social', new RegExp(`\\b${NOME}[\\s\\-]?assistente[\\s\\-]?social\\b`)],
  // O proprio Zeus. Entra na lista mesmo estando fora do alcance dele, para a
  // recusa ser a certa ("nao mexo em mim mesmo") e nao o vago "nao entendi".
  ['moviki-voice-interface', new RegExp(`\\b(${NOME}[\\s\\-]?voice|voice[\\s\\-]?interface)\\b`)],
  // "o repositorio Moviki", sem sufixo, e o site publico.
  ['moviki', new RegExp(`\\brepositorio ${NOME}\\b`)],
  ['moviki', new RegExp(`\\b${NOME}\\b[\\s]*$`)],
]

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
  // Nome proprio primeiro: "moviki-app" e mais especifico que "painel".
  for (const [repo, re] of REPO_POR_NOME) {
    if (re.test(t)) return repo
  }
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
/**
 * ORDEM PERMANENTE — o que vai para o caderno e nunca mais sai.
 *
 * O Paulo pediu um "super cerebro" porque estava cansado de repetir. Estas sao
 * as formas em que uma pessoa diz "isto vale de hoje em diante", e elas sao
 * diferentes de uma ordem comum: "muda o botao" e para agora; "de agora em
 * diante use verde" e para sempre.
 *
 * O caderno viaja em toda chamada, entao cada linha e paga para sempre. Por
 * isso aqui a lista e ESTREITA, ao contrario da de verbos de mudanca: melhor
 * ele nao anotar e o Paulo repetir "anota isso" do que o caderno encher de
 * frase solta e o que importa se perder no meio.
 */
const ORDEM_PERMANENTE =
  /\b(anota (isso|ai|isto)|anote (isso|ai|isto)|lembra (disso|sempre)|lembre (disso|sempre)|nao esquece (disso|mais)|de agora em diante|daqui (pra|para) frente|a partir de agora|de hoje em diante|sempre que voce|toda vez que voce|nunca mais|regra nova|fica valendo|guarda isso)\b/

export function pareceAnotacao(frase) {
  const t = normalizar(frase)
  return Boolean(t) && ORDEM_PERMANENTE.test(t)
}

export function pareceTrabalho(frase) {
  const t = normalizar(frase)
  if (!t) return false
  // Pergunta sobre a IDEIA nao e ordem: "o que voce acha de mudar a cor?" e
  // conversa. A duvida ali e sobre a ideia, nao sobre o fazer.
  if (/\b(o que voce acha|voce acha que|sera que|o que e melhor|qual e melhor)\b/.test(t)) {
    return false
  }
  return VERBO_DE_MUDANCA.test(t) || PEDIDO_EDUCADO.test(t)
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

/**
 * PEDIDO DE OLHAR PARA FORA — pesquisar na internet.
 *
 * Pedido do Paulo em 18/09/2026: "de a ele informacoes para que ele pesquise na
 * internet tambem, para ficar mais inteligente".
 *
 * Roda ANTES da analise de codigo, e por um motivo: "procura" e "acha" estao
 * nas duas listas. "Procura na internet quanto custa a Hetzner" nao e para
 * virar varredura no repositorio — e o contrario tambem nao. Quem tem a palavra
 * "internet", "web" ou "la fora" ganha.
 */
// ATENCAO A QUEM FOR "CONSERTAR" ESTA EXPRESSAO: `pesquis` e `googl` abrem com
// \b e FECHAM SEM ELE, de proposito — sao PREFIXOS. Tem que casar "pesquisa",
// "pesquisar", "pesquisada", "pesquisando", "googlei". Fechar com \b aqui faria
// "da uma pesquisada sobre isso" deixar de ser pedido de busca.
//
// (Em `ONDE_MORA` a regra e a oposta, e pelo mesmo cuidado: la o \b aberto fazia
// "bot" casar dentro de "BOTao". Prefixo so quando a intencao E o prefixo.)
const DIZ_INTERNET = /\b(?:pesquis|googl)|\b(na internet|na web|no google|la fora|noticia|noticias)\b/

/**
 * Sinal mais fraco: sugere coisa de fora, mas pode ser do codigo tambem.
 *
 * "o mercado" pode ser mercado de verdade ou a pagina de mercado do painel. Por
 * isso estes so ganham quando ele NAO nomeou um repositorio.
 */
const CHEIRA_A_FORA =
  /\b(mercado|concorrente|concorrentes|concorrencia|hoje em dia|atualmente|ultima versao|quanto custa a|lancou|lancamento)\b/

export function pareceBusca(frase) {
  const t = normalizar(frase)
  if (!t) return false
  // "no google" ganha de tudo. "procura no google o que mudou no WhatsApp" fala
  // de WhatsApp, que e palavra do repositorio do atendente — mas ninguem
  // procura no Google dentro do proprio codigo.
  if (DIZ_INTERNET.test(t)) return true
  // Sinal fraco: so vale se ele nao nomeou parte nenhuma do Moviki.
  if (repoDoAssunto(frase)) return false
  return CHEIRA_A_FORA.test(t)
}

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

// ---------------------------------------------------------------------------
// O QUE O ZEUS PROMETEU COM A PROPRIA BOCA
// ---------------------------------------------------------------------------
//
// O DEFEITO QUE ISTO FECHA — 18/09/2026, ultima rodada do dia
//
// O Paulo, pela terceira vez no mesmo dia: *"ele aceita, diz que vai fazer,
// depois daqui a dois minutos ele diz que ainda e pra eu fazer"*. E, nas
// palavras do proprio Zeus para ele: *"o disparo nao esta pegando"*.
//
// O Zeus estava certo, e a frase dele descreve o defeito melhor que eu
// descreveria. A ordem caia na CONVERSA em vez de virar tarefa; na conversa
// ele responde bonito, concorda, promete — e nao existe nada do outro lado
// para fazer. Dois minutos depois, olhando a lista de tarefas em andamento
// (que estava vazia, e honestamente vazia), ele dizia que nao havia nada.
//
// A CORRECAO ANTERIOR NAO BASTA, E ISSO E O IMPORTANTE AQUI.
// A rodada passada alargou a lista de verbos de mudanca (`VERBO_DE_MUDANCA`).
// Isso conserta as frases que eu consegui imaginar. Mas a lista e uma aposta
// sobre o vocabulario de OUTRA pessoa, e toda aposta dessas perde um dia: basta
// o Paulo dizer "da um jeito naquele rodape" para a ordem sumir de novo.
//
// Entao aqui entra uma rede embaixo, e ela nao depende de eu adivinhar nada:
// **se o Zeus PROMETEU, a promessa vira tarefa.** Ele mesmo — que leu a frase
// inteira, com contexto, e entendeu que era ordem — passa a ser o segundo
// classificador. Nao ha lista de verbos capaz de errar aqui, porque quem
// decide nao e mais a lista: e a resposta dele.
//
// PROMESSA SEM TAREFA E MENTIRA. Esta e a regra, e ela vale nos dois sentidos:
// ou o Zeus nao promete, ou o que ele prometeu comeca a acontecer de verdade.

/** Verbos que, prometidos, significam MEXER no codigo. */
const PROMETE_MEXER =
  /(?<!\bnao )\b(vou|irei|farei|ja vou|vou ja)\b[^.!?]{0,40}\b(fazer|faze-lo|mexer|mudar|alterar|trocar|arrumar|consertar|corrigir|ajustar|colocar|botar|criar|montar|gerar|construir|acrescentar|adicionar|incluir|inserir|tirar|remover|esconder|melhorar|refazer|reescrever|resolver|implementar|aplicar|renomear|mover|organizar|atualizar|instalar|configurar|ativar|ligar|desativar|duplicar|substituir|padronizar|trabalhar|cuidar|providenciar|preparar|editar|abrir um pull request|abrir o pull request)\b/

/** Promessa sem verbo: "pode deixar", "deixa comigo", "ja estou nisso". */
const PROMETE_SOLTO =
  /\b(pode deixar|deixa comigo|deixe comigo|ja estou nisso|ja comecei|ja comecando|estou cuidando disso|vou cuidar disso|vou dar um jeito|me encarrego|conto quando terminar|te aviso quando terminar|te conto quando terminar|vou nessa)\b/

/** Verbos que, prometidos, significam so OLHAR — sem mexer em nada. */
const PROMETE_OLHAR =
  /(?<!\bnao )\b(vou|irei|ja vou)\b[^.!?]{0,40}\b(olhar|dar uma olhada|conferir|verificar|checar|analisar|examinar|revisar|investigar|auditar|inspecionar|ler o codigo|entender o que|descobrir|avaliar)\b/

/**
 * O Zeus prometeu alguma coisa nesta resposta?
 *
 * Devolve `'trabalho'`, `'analise'` ou `null`.
 *
 * Mexer ganha de olhar quando os dois aparecem ("vou olhar e arrumar"): quem
 * promete arrumar prometeu a coisa maior, e entregar a maior cobre a menor.
 */
export function prometeuFazer(texto) {
  const t = normalizar(texto)
  if (!t) return null
  if (PROMETE_MEXER.test(t) || PROMETE_SOLTO.test(t)) return 'trabalho'
  if (PROMETE_OLHAR.test(t)) return 'analise'
  return null
}

/**
 * Devolve o assunto vedado da frase, ou null.
 *
 * Null aqui nao quer dizer "pode tudo": quer dizer que a frase nao caiu em
 * nenhuma das portas fechadas. Quem decide o resto continua sendo a trava.
 *
 * `exigeVerbo: false` desliga a exigencia de verbo de mudanca. Serve para um
 * caso so, e ele e importante: quando quem ja disse que vai MEXER foi o
 * proprio Zeus (ver `prometeuFazer`). Ali o "verbo de mudanca" esta na
 * resposta dele, nao na frase do Paulo — e continuar exigindo o verbo na
 * frase do Paulo deixaria a cerca do dinheiro e do preco aberta justamente no
 * caminho novo.
 */
export function assuntoVedado(frase, { exigeVerbo = true } = {}) {
  const t = normalizar(frase)
  if (!t) return null

  // Sem verbo de mudanca e conversa, nao ordem. Conversa e livre.
  if (exigeVerbo && !VERBO_DE_MUDANCA.test(t)) return null

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
