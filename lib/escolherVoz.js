// lib/escolherVoz.js  (repo: moviki-voice-interface)
//
// QUAL VOZ O ZEUS USA.
//
// O ERRO QUE ISTO CONSERTA — 18/09/2026
// A voz estava travada em `im_nicola`. No Kokoro, a PRIMEIRA LETRA do nome e
// o idioma da voz: `i` = italiano. Ou seja, o Zeus era um italiano lendo
// portugues. E por isso que soava robotico e atropelando as palavras: os sons
// que aquela voz sabe fazer nao sao os do portugues. Nao era defeito do
// Kokoro nem da maquina — era voz do idioma errado.
//
// As vozes brasileiras comecam com `p`:
//   pm_alex   masculina
//   pm_santa  masculina
//   pf_dora   feminina
//
// POR QUE EXISTE UM JEITO DE TROCAR PELA URL
// Escolher voz e coisa de ouvido, nao de argumento. Em vez de refazer o build
// a cada tentativa, `?voz=pm_santa` deixa o Paulo ouvir as tres na hora e
// decidir. Depois a escolhida vira o padrao aqui no codigo.
//
// Nada disso e dado de confianca — vem da barra de endereco. Por isso a lista
// e fechada: um nome fora dela cai no padrao em vez de ir para o servidor.

/** As vozes que o Zeus pode usar. Lista fechada, de proposito. */
export const VOZES = {
  pm_alex: 'masculina brasileira',
  pm_santa: 'masculina brasileira, mais grave',
  pf_dora: 'feminina brasileira',
  im_nicola: 'masculina ITALIANA — lia portugues errado, mantida so para comparar',
}

export const VOZ_PADRAO = 'pm_alex'

/**
 * Decide a voz a partir da barra de endereco.
 *
 *   busca    o `?...` da URL (window.location.search)
 *   padrao   para onde cair quando nao pedirem nada, ou pedirem bobagem
 */
export function escolherVoz(busca, padrao = VOZ_PADRAO) {
  let pedida = null
  try {
    pedida = new URLSearchParams(busca || '').get('voz')
  } catch {
    pedida = null
  }
  if (pedida && Object.prototype.hasOwnProperty.call(VOZES, pedida)) return pedida
  return padrao
}

/**
 * Ritmo da fala, tambem ajustavel pela URL: `?vel=0.9`.
 *
 * Existe pelo mesmo motivo da voz: acertar o ritmo e coisa de ouvido. E fica
 * preso entre 0,6 e 1,4 porque fora disso nao e mais ajuste, e defeito — voz
 * arrastada demais ou correndo demais nao se entende.
 */
export const VELOCIDADE_PADRAO = 1.0

export function escolherVelocidade(busca, padrao = VELOCIDADE_PADRAO) {
  let pedida = null
  try {
    pedida = new URLSearchParams(busca || '').get('vel')
  } catch {
    return padrao
  }
  const n = Number(pedida)
  if (!Number.isFinite(n) || n < 0.6 || n > 1.4) return padrao
  return n
}
