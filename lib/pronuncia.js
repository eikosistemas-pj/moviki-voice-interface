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

function padraoTolerante(termo) {
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

  for (const [termo, como] of DICIONARIO) {
    const alvo = padraoTolerante(termo)
    // (^|nao-letra) TERMO (nao-letra|fim) — comparando sem acento nem caixa.
    const re = new RegExp(
      `(^|[^0-9a-zA-ZÀ-ÿ])(${alvo})(?=[^0-9a-zA-ZÀ-ÿ]|$)`,
      'gi'
    )
    saida = saida.replace(re, (inteiro, antes, achado) => {
      // Confere sem acento: "Móviki" digitado pelo Paulo tambem casa.
      if (achatar(achado) !== achatar(termo)) return inteiro
      return `${antes}${como}`
    })
  }

  return saida
}
