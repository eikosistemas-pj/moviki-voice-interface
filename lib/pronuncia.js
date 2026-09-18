// lib/pronuncia.js  (repo: moviki-voice-interface)
//
// COMO O ZEUS PRONUNCIA AS PALAVRAS.
//
// O PROBLEMA — 18/09/2026
// Com a voz brasileira certa no lugar, sobrou o outro erro: ela le palavra
// estrangeira e nome de marca pelas regras do portugues. "Enterprise" saia
// "enterprí-se". "Moviki" saia com a silaba forte no lugar errado. Um
// assistente que erra o nome da propria empresa nao passa confianca.
//
// A SOLUCAO
// Antes do texto virar audio, ele passa por aqui e as palavras problematicas
// sao trocadas por uma grafia que SOA certo em portugues. Nao e traducao: e
// escrever do jeito que se fala.
//
//   "o plano Enterprise"  ->  "o plano enterpráiz"
//
// Ninguem le esse texto — ele so existe no caminho para o motor de voz. A
// tela nao mostra transcricao, entao a grafia esquisita nunca aparece.
//
// COMO CRESCER ESTA LISTA
// Toda vez que o Zeus errar uma palavra, ela entra aqui com a grafia que soa
// certo. E manutencao normal, nao remendo: nenhum motor de voz acerta nome de
// marca sem alguem ensinar.
//
// CUIDADO AO EDITAR
// A ordem importa. As entradas mais compridas vem primeiro, senao "Pull"
// seria trocado sozinho e "Pull Request" nunca casaria.

/**
 * Como falar cada coisa.
 *
 * Chave: o que aparece no texto. Valor: como deve soar.
 * A comparacao ignora maiusculas e acentos.
 */
export const DICIONARIO = [
  // --- O nome da casa vem primeiro, e o mais importante ---------------------
  ['moviki', 'Movíki'],

  // --- Termos de duas palavras, antes das de uma ----------------------------
  ['pull request', 'pul rikuést'],
  ['food truck', 'fúdi trâque'],
  ['service account', 'sérvis acaunt'],

  // --- Planos e dinheiro ---------------------------------------------------
  ['enterprise', 'enterpráiz'],
  ['premium', 'prêmium'],
  ['trial', 'tráiol'],
  ['checkout', 'chéqui-aut'],
  ['pix', 'pix'],
  ['asaas', 'Assaás'],

  // --- Servicos e ferramentas ----------------------------------------------
  ['whatsapp', 'uótsápi'],
  ['facebook', 'feissibúqui'],
  ['instagram', 'ínstagram'],
  ['telegram', 'télegram'],
  ['firestore', 'fáiar-stór'],
  ['firebase', 'fáiar-beis'],
  ['vercel', 'versél'],
  ['github', 'guitirrábi'],
  ['hetzner', 'rétisner'],
  ['resend', 'rissénd'],
  ['anthropic', 'antrópic'],
  ['claude', 'clôd'],
  ['kokoro', 'kokôro'],
  ['nginx', 'enguín-éx'],
  ['systemd', 'sistem-dê'],

  // --- Palavras de trabalho ------------------------------------------------
  ['deploy', 'diplói'],
  ['commit', 'comít'],
  ['branch', 'brântchi'],
  ['merge', 'mârdji'],
  ['build', 'bíld'],
  ['backup', 'béqui-api'],
  ['upload', 'âplôd'],
  ['token', 'tôquen'],
  ['slug', 'slâg'],
  ['live', 'láivi'],
  ['reels', 'ríls'],
  ['feed', 'fíd'],
  ['site', 'sáiti'],
  ['online', 'onláini'],
  ['offline', 'ofláini'],
  ['e-mail', 'imêiu'],
  ['email', 'imêiu'],
  ['software', 'sófti-uér'],
  ['dashboard', 'déchi-bord'],

  // --- COMO BRASILEIRO FALA DE VERDADE -------------------------------------
  //
  // PEDIDO DO PAULO — 18/09/2026: "ele nao fala 'voce', ele poe entonacao no
  // VO. Seria interessante instalar nele os vicios de linguagem brasileiros."
  //
  // As duas queixas tem o mesmo conserto. O motor lia "você" como palavra
  // escrita, com peso na primeira silaba — e brasileiro nenhum fala assim: a
  // gente fala "cê". Trocar aqui acerta a entonacao E deixa a fala natural de
  // uma vez so.
  //
  // O TEXTO ESCRITO NAO MUDA. Isto vive so no caminho ate o motor de voz: o
  // Pull Request, a trilha e o registro continuam em portugues formal. E fala,
  // nao redacao.
  //
  // O QUE FICOU DE FORA, DE PROPOSITO
  // "nao e" -> "ne" so vale no fim da frase ("ta pronto, ne?"). No meio,
  // "isso nao e meu" viraria "isso ne meu", que nao e sotaque, e erro.
  // "para" sozinho tambem ficou fora: "o robo para de trabalhar" viraria "o
  // robo pra de trabalhar". Por isso so as formas com artigo entram, e elas
  // vem ANTES das outras, senao "para" casaria primeiro e comeria o artigo.
  //
  // Se algum dia soar forcado, e so apagar este bloco: nada mais depende dele.
  // A ORDEM AQUI OBEDECE A REGRA DA CASA: o que CONTEM outro vem antes.
  // "para vocês" antes de "para você", "vocês" antes de "você", "estavam"
  // antes de "estava" — senao o curto casa primeiro e come o resto.
  ['para vocês', 'procês', { deFrase: true }],
  ['para você', 'procê', { deFrase: true }],
  ['para nós', 'pra nós', { deFrase: true }],
  ['para mim', 'pra mim', { deFrase: true }],
  ['para isso', 'pra isso', { deFrase: true }],
  ['para ele', 'pra ele', { deFrase: true }],
  ['para ela', 'pra ela', { deFrase: true }],
  // `exato` desliga a tolerancia a acento SO nestas quatro.
  //
  // O acento e o que separa o verbo da preposicao: "mandei para as duas" e
  // preposicao mais artigo, e vira "pras duas"; "o robo para às seis" e o
  // VERBO parar mais "às", e nao pode virar "o robo pras seis".
  // Sem isto, a tolerancia a acento (que faz "a" casar com "à") junta os dois
  // casos e estraga o segundo.
  ['para os', 'pros', { deFrase: true, exato: true }],
  ['para as', 'pras', { deFrase: true, exato: true }],
  ['para o', 'pro', { deFrase: true, exato: true }],
  ['para a', 'pra', { deFrase: true, exato: true }],
  ['vocês', 'cês', { deFrase: true }],
  ['você', 'cê', { deFrase: true }],
  ['estavam', 'tavam', { deFrase: true }],
  ['estava', 'tava', { deFrase: true }],
  ['estão', 'tão', { deFrase: true }],
  ['estou', 'tô', { deFrase: true }],
  ['está', 'tá', { deFrase: true }],

  // --- Siglas: letra por letra, senao viram palavra ------------------------
  ['lgpd', 'éle gê pê dê'],
  ['cpf', 'cê pê éfe'],
  ['saas', 'sés'],
  ['api', 'a-pê-i'],
  ['url', 'u-érre-éle'],
  ['pr', 'pê-érre'],
  ['ia', 'i-á'],
  ['uf', 'u-éfe'],
]

/** Tira acentos e baixa a caixa, so para comparar. */
function achatar(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/**
 * Escapa o que for simbolo, para o termo virar expressao de busca segura.
 * Sem isso, um termo com ponto ou hifen viraria curinga.
 */
function escapar(termo) {
  return termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Cada vogal aceita as versoes acentuadas dela.
 *
 * A busca comum compara letra por letra, entao "moviki" nao acharia "Móviki"
 * — e o Paulo escreve o nome da empresa com acento tanto quanto sem. Marcar
 * so `ignorar maiusculas` nao resolve: acento e outra letra para a maquina.
 */
const VARIANTES = {
  a: 'aàáâãä',
  e: 'eèéêë',
  i: 'iìíîï',
  o: 'oòóôõö',
  u: 'uùúûü',
  c: 'cç',
  n: 'nñ',
}

function padraoTolerante(termo, exato = false) {
  // `exato` mantem os acentos como estao: ver o comentario das entradas
  // "para o/a/os/as" no dicionario.
  if (exato) return escapar(termo)
  return escapar(termo)
    .split('')
    .map((letra) => {
      const variantes = VARIANTES[letra.toLowerCase()]
      return variantes ? `[${variantes}]` : letra
    })
    .join('')
}

/**
 * Passa o texto pelo dicionario antes de ele virar audio.
 *
 * Troca palavra inteira apenas: "ia" nao pode casar dentro de "familia", e
 * "pr" nao pode casar dentro de "proximo". A fronteira aqui e feita na mao
 * porque a do JavaScript considera letra acentuada como separador, e ai
 * "Pró" seria partido no meio.
 */
export function ajustarPronuncia(texto) {
  if (!texto) return ''
  let saida = String(texto)

  for (const [termo, como, opcoes] of DICIONARIO) {
    const alvo = padraoTolerante(termo, opcoes?.exato)
    // (^|nao-letra) TERMO (nao-letra|fim) — comparando sem acento nem caixa.
    const re = new RegExp(
      `(^|[^0-9a-zA-ZÀ-ÿ])(${alvo})(?=[^0-9a-zA-ZÀ-ÿ]|$)`,
      'gi'
    )
    saida = saida.replace(re, (inteiro, antes, achado, posicao, todo) => {
      // Confere sem acento: "Móviki" digitado pelo Paulo tambem casa. Nas
      // entradas `exato`, a propria expressao ja garantiu o acento certo.
      if (!opcoes?.exato && achatar(achado) !== achatar(termo)) return inteiro
      // MAIUSCULA DE COMECO DE FRASE SOBREVIVE A TROCA — mas so onde faz
      // sentido.
      //
      // "Você quer" tem que virar "Cê quer", nao "cê quer": o motor de voz usa
      // pontuacao e caixa para saber onde a frase comeca, e frase que abre
      // minuscula sai com a entonacao do meio da anterior.
      //
      // So que isso vale para PALAVRA COMUM, marcada com `deFrase`. Nome de
      // marca e sigla tem grafia propria, escolhida a mao ("enterpráiz",
      // "éle gê pê dê"), e capitalizar por conta propria estragaria ela.
      if (!opcoes?.deFrase) return `${antes}${como}`
      const antesDisso = todo.slice(0, posicao + antes.length)
      const comecaFrase = /(^|[.!?…]["'”’)\]]*\s+)$/.test(antesDisso)
      const falado = comecaFrase ? como[0].toUpperCase() + como.slice(1) : como
      return `${antes}${falado}`
    })
  }

  return saida
}
