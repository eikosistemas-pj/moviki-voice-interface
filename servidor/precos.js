// servidor/precos.js  (repo: moviki-voice-interface)
//
// A TABELA DE PRECO — UM LUGAR SO.
//
// O Paulo decidiu em 18/09/2026 que o custo do agente aparece no CRM em
// REAIS. Nao em tokens, nao em "quanto do teto". Reais.
//
// Traduzir token em real precisa de duas coisas que ENVELHECEM: o preco que a
// Anthropic cobra por modelo, e a cotacao do dolar. Envelhecer nao e defeito,
// e a natureza disso — o defeito seria essa tabela estar espalhada por quatro
// arquivos e envelhecer em quatro velocidades diferentes. Por isso ela mora
// aqui, sozinha, e e o unico lugar a mexer quando o preco mudar.
//
// A REGRA DURA: MODELO QUE NAO ESTA NA TABELA NAO TEM PRECO INVENTADO.
// Devolve `null`, que o painel mostra como "nao sei". Um numero chutado num
// painel de custo e pior que numero nenhum: o Paulo tomaria decisao de
// dinheiro em cima de invencao, que e exatamente o defeito do Zeus que a
// gente passou o dia consertando.

/**
 * Preco em DOLAR por MILHAO de tokens, do jeito que a Anthropic publica.
 * Conferido em 18/09/2026.
 *
 *   entrada  token novo, pago cheio
 *   cache    token lido do cache, ~um decimo da entrada
 *   criacao  token GRAVADO no cache, ~1,25x a entrada
 *   saida    token que o modelo escreve
 */
export const TABELA = {
  'claude-haiku-4-5': { entrada: 1, cache: 0.1, criacao: 1.25, saida: 5 },
  'claude-sonnet-5': { entrada: 2, cache: 0.2, criacao: 2.5, saida: 10 },
  'claude-opus-5': { entrada: 5, cache: 0.5, criacao: 6.25, saida: 25 },
}

/**
 * A busca na internet nao e cobrada em token, e por busca feita:
 * 10 dolares a cada mil. Sem isto o `servidor/busca.js` apareceria de graca
 * no painel, e ele e justamente o pedaco que gasta sem ninguem pedir.
 */
export const DOLARES_POR_BUSCA = 10 / 1000

/**
 * A cotacao do dolar. Mora no `zeus.env` (ZEUS_DOLAR) porque muda todo dia e
 * nao vale um Pull Request por centavo.
 *
 * O padrao existe para o painel nunca ficar mudo, e e propositalmente
 * conservador: melhor o Paulo achar que gastou um pouco mais do que achar que
 * gastou menos.
 */
export const DOLAR_PADRAO = 5.6

export function cotacao() {
  const n = Number(process.env.ZEUS_DOLAR)
  return Number.isFinite(n) && n > 0 ? n : DOLAR_PADRAO
}

export function precoDe(modelo) {
  return TABELA[String(modelo || '')] || null
}

/**
 * Quanto custou uma chamada, em dolar. `null` quando o modelo e desconhecido.
 *
 * As buscas sao somadas mesmo assim: elas tem preco proprio, que independe do
 * modelo. Mas se o modelo for desconhecido a conta inteira vira `null` — meia
 * verdade num painel de custo vale menos que um "nao sei" honesto.
 */
export function emDolares({ modelo, entrada = 0, cache = 0, criacao = 0, saida = 0, buscas = 0 }) {
  const p = precoDe(modelo)
  if (!p) return null
  const porToken =
    (Number(entrada) || 0) * p.entrada +
    (Number(cache) || 0) * p.cache +
    (Number(criacao) || 0) * p.criacao +
    (Number(saida) || 0) * p.saida
  return porToken / 1_000_000 + (Number(buscas) || 0) * DOLARES_POR_BUSCA
}

/** O mesmo, em reais. `null` continua sendo `null` — nunca vira zero. */
export function emReais(uso) {
  const d = emDolares(uso)
  return d === null ? null : d * cotacao()
}

/** Arredonda para centavo, que e a unidade que o Paulo le. */
export function centavos(reais) {
  if (reais === null || !Number.isFinite(reais)) return null
  return Math.round(reais * 100) / 100
}
