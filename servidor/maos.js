// servidor/maos.js  (repo: moviki-voice-interface)
//
// ONDE O ZEUS PODE ENCOSTAR.
//
// A trava do turno (lib/turno.js) decide SE ele pode agir. Esta aqui decide
// EM QUE ele encosta quando age. Sao perguntas diferentes e por isso moram
// separadas: turno aberto nao vira licenca para mexer no robo do dinheiro.
//
// O DESENHO, EM UMA FRASE
// O Zeus PROPOE, nunca PUBLICA. Ele trabalha num ramo proprio e abre um Pull
// Request; quem junta na main e o Paulo, com o dedo dele. A regra de ouro
// numero 1 do Moviki e nunca fazer push direto na main, porque o Vercel
// publica a main na hora para os clientes — e um robo nao e excecao.
//
// Assim, o pior caso de um erro do Zeus e um Pull Request ruim esperando
// aprovacao. Nao e um site fora do ar.

/**
 * Onde ele pode trabalhar.
 *
 * `moviki-robo` FICA DE FORA. E o robo do dinheiro: assinatura, webhook do
 * Asaas, comissao, saque. O mapa mestre diz que ele "muda o minimo possivel,
 * de proposito" — robo mexendo ali, ainda que por Pull Request, e risco que
 * nao se paga. Se um dia precisar, e decisao do Paulo, escrita.
 *
 * `moviki-voice-interface` tambem fica de fora: e o proprio Zeus. Ele nao
 * mexe em si mesmo nem na trava que o segura.
 */
export const REPOS_PERMITIDOS = [
  'moviki',
  'moviki-app',
  'moviki-ai',
  'moviki-assistente-social',
]

/**
 * Caminhos em que ninguem encosta, nem nos repositorios permitidos.
 *
 * Cada linha aqui e uma porta que, aberta, deixaria o Zeus contornar as
 * outras travas sem precisar quebrar nenhuma.
 */
export const CAMINHOS_PROIBIDOS = [
  // Regras do Firestore e do Storage: e a seguranca de todo lojista.
  { padrao: /(^|\/)firebase\//, porque: 'regra de seguranca e da Guarda' },
  { padrao: /\.rules$/, porque: 'regra de seguranca e da Guarda' },

  // Rotina automatica: mexer aqui e mexer no que roda sozinho, com os
  // segredos do repositorio na mao.
  { padrao: /(^|\/)\.github\//, porque: 'rotina automatica e do Paulo' },

  // Segredo e configuracao de publicacao.
  { padrao: /(^|\/)\.env/, porque: 'segredo nunca' },
  { padrao: /(^|\/)vercel\.json$/, porque: 'configuracao de publicacao e do Paulo' },

  // A memoria do projeto. O mapa se atualiza no mesmo Pull Request da
  // alteracao, pela mao de quem entende a decisao — nao por robo sozinho.
  { padrao: /(^|\/)CLAUDE\.md$/, porque: 'o mapa mestre e do Paulo' },

  // Dependencia: trocar biblioteca sem ninguem olhando e trocar peca de
  // motor no escuro.
  { padrao: /(^|\/)package-lock\.json$/, porque: 'dependencia e decisao humana' },
  { padrao: /(^|\/)node_modules\//, porque: 'isso nem deveria estar no git' },

  // Preco e plano. A tabela PLANOS vive no moviki-robo, que ja esta de fora,
  // mas a regra fica escrita aqui tambem: quando o assunto e cobranca, defesa
  // em duas camadas nao e exagero.
  { padrao: /(^|\/)lib\/asaas\.js$/, porque: 'preco e plano sao do Paulo' },
]

/** Toda branch do Zeus comeca assim, para o Paulo reconhecer de longe. */
export const PREFIXO_BRANCH = 'zeus/'

/**
 * O Zeus pode mexer neste arquivo?
 *
 * O motivo e escrito para ser FALADO: ele sai pela boca do Zeus quando ele
 * recusa. "ACCESS_DENIED" nao serve para quem esta ouvindo.
 */
export function podeMexer(repo, caminho) {
  if (!repo || !caminho) {
    return { permitido: false, motivo: 'nao entendi em que arquivo mexer' }
  }

  if (!REPOS_PERMITIDOS.includes(repo)) {
    return {
      permitido: false,
      motivo:
        repo === 'moviki-robo'
          ? 'nao encosto no robo do dinheiro'
          : repo === 'moviki-voice-interface'
            ? 'nao mexo em mim mesmo'
            : `nao trabalho no ${repo}`,
    }
  }

  // Caminho para fora da pasta do projeto. Um ".." solto alcancaria o resto
  // do disco — inclusive o arquivo onde mora a chave da Anthropic.
  if (caminho.includes('..') || caminho.startsWith('/')) {
    return { permitido: false, motivo: 'esse caminho sai da pasta do projeto' }
  }

  for (const { padrao, porque } of CAMINHOS_PROIBIDOS) {
    if (padrao.test(caminho)) return { permitido: false, motivo: porque }
  }

  return { permitido: true, motivo: 'dentro do que eu posso' }
}

/**
 * O nome do ramo serve?
 *
 * `main` recusada com todas as letras: e a regra de ouro numero 1, e o Vercel
 * publica a main na hora para os clientes.
 */
export function ramoValido(nome) {
  if (!nome || typeof nome !== 'string') return false
  if (nome === 'main' || nome === 'master') return false
  if (!nome.startsWith(PREFIXO_BRANCH)) return false
  // Espaco, til e circunflexo quebram o git de formas criativas; melhor
  // recusar aqui do que descobrir no meio do trabalho.
  return /^[a-z0-9/_-]+$/.test(nome) && nome.length <= 80
}
