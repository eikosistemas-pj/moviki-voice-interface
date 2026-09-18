/**
 * Voz do ZEUS — travada, sem menus.
 *
 * VOZ FIXA: `im_nicola`, escolhida pelo Paulo. Nao existe seletor, nao
 * existe preferencia salva, nao existe rota de catalogo consultada. Trocar
 * a voz exige mexer nesta constante.
 *
 * Por que o motor local e nao o Web Speech Synthesis do navegador:
 * a voz "Nicola" e um modelo do Kokoro que roda no servidor. O
 * speechSynthesis do navegador expoe apenas as vozes instaladas no sistema
 * operacional de cada visitante — num servidor Linux headless a lista vem
 * vazia, e num Windows/Mac qualquer viria com outras vozes, diferentes por
 * maquina. Travar em "Nicola" de verdade, igual para todos, exige o motor
 * proprio. Ver zeus-voz/README.md.
 */
export const VOZ_FIXA = 'im_nicola'

export const NOME_ASSISTENTE = 'Zeus'

export const IDIOMA_VOZ = 'pt-br'

export const ENDPOINT_TTS =
  import.meta.env.VITE_ZEUS_TTS_ENDPOINT || '/api/voz'

/** Ritmo natural da voz. Assistente de comando nao fala apressado. */
export const VELOCIDADE_VOZ = 1.0

export const ESTADOS = {
  PARADO: 'parado',
  OUVINDO: 'ouvindo',
  PENSANDO: 'pensando',
  FALANDO: 'falando',
  ERRO: 'erro',
}

/**
 * Humores do Zeus.
 *
 * Inteligencia de comando, focada em negocio: nada de fofo. Ate a
 * felicidade aqui e sobria — olhar firme, sem euforia.
 */
export const HUMORES = {
  NEUTRO: 'neutro',
  FELIZ: 'feliz',
  ENTUSIASMO: 'entusiasmo',
  IMPACIENCIA: 'impaciencia',
  FIRMEZA: 'firmeza',
}
