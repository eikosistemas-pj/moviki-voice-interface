import { escolherVelocidade, escolherVoz } from '../../lib/escolherVoz'

/**
 * Voz do ZEUS.
 *
 * ATE 18/09/2026 ESTAVA ERRADA. A voz era `im_nicola` e, no Kokoro, a
 * primeira letra do nome e o IDIOMA: `i` = italiano. O Zeus era um italiano
 * lendo portugues — dai o "robotizado, atropelando as palavras". Nao era
 * defeito do motor nem da maquina: era voz do idioma errado.
 *
 * Agora o padrao e brasileiro (ver lib/escolherVoz.js). Para ouvir as outras
 * sem refazer o build: `?voz=pm_santa`, `?voz=pf_dora`, ou `?voz=im_nicola`
 * para comparar com a antiga.
 *
 * Por que o motor local e nao o Web Speech Synthesis do navegador:
 * o speechSynthesis expoe apenas as vozes instaladas no sistema operacional
 * de cada visitante — num servidor Linux headless a lista vem vazia, e num
 * Windows/Mac viria com outras vozes, diferentes por maquina. Uma voz igual
 * para todos exige o motor proprio. Ver zeus-voz/README.md.
 */
export const VOZ_FIXA = escolherVoz(
  typeof window === 'undefined' ? '' : window.location.search
)

export const NOME_ASSISTENTE = 'Zeus'

export const IDIOMA_VOZ = 'pt-br'

export const ENDPOINT_TTS =
  import.meta.env.VITE_ZEUS_TTS_ENDPOINT || '/api/voz'

/**
 * O cerebro do Zeus (servidor/zeus.js, na VPS).
 *
 * A tela manda o que foi falado e recebe o que ele vai dizer. Nenhuma decisao
 * mora aqui: a trava do turno vive no servidor, porque o que roda no
 * navegador qualquer um edita com o console aberto.
 */
export const ENDPOINT_CEREBRO =
  import.meta.env.VITE_ZEUS_ENDPOINT || '/api/zeus'

/**
 * Tapa-buraco de porta, NAO seguranca.
 *
 * Isto viaja para o navegador e qualquer um le no codigo da pagina. Serve
 * para o endereco nao ficar aberto de brincadeira na internet. Quem segura o
 * prejuizo de verdade e o teto diario do servidor.
 */
export const TOKEN_ZEUS = import.meta.env.VITE_ZEUS_TOKEN || ''

/** Ritmo da fala. Ajustavel pela URL (`?vel=0.9`) para acertar de ouvido. */
export const VELOCIDADE_VOZ = escolherVelocidade(
  typeof window === 'undefined' ? '' : window.location.search
)

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
