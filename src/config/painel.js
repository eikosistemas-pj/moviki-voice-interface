/**
 * Geometria e camadas animadas do painel do ZEUS.
 *
 * Tudo em PORCENTAGEM sobre `public/zeus.png`, nunca em pixels: assim o
 * alinhamento sobrevive a qualquer resolucao de tela.
 *
 * ============================================================
 *  CALIBRADO contra o zeus.png real (1672x941, exatamente 16:9).
 *
 *  Olhos e labios: medidos por deteccao de pixels azul-neon
 *  (limiar B>220 / B-R>100 para o nucleo dos olhos; B>150 / B-R>60
 *  restrito a faixa da boca), conferidos com miras sobre a imagem.
 *
 *  Painéis e pins: lidos sobre grade de 5% sobreposta a imagem. A
 *  deteccao automatica de bordas nao serve aqui — as caixas tem canto
 *  arredondado e glow, entao nao produzem linha continua.
 *
 *  Se o zeus.png mudar, recalibre: `?calibrar=1` desenha as marcas
 *  sobre a imagem e voce ajusta os numeros deste arquivo.
 * ============================================================
 */

/** Caminho da imagem base. Vive em `public/`, servida na raiz. */
export const IMAGEM_ZEUS = '/zeus.png'

/**
 * Pupilas mecanicas.
 *
 * Medido: esquerdo 46.97% / 21.35%, direito 52.86% / 21.42%.
 * Diametro real da pupila acesa: ~1.0-1.3% da largura.
 *
 * As pupilas da imagem JA brilham. Estas camadas somam pulsacao em
 * `mix-blend-mode: screen`; o nucleo e pequeno de proposito, porque
 * cobrir a pupila apagaria o desenho original do olho.
 */
export const OLHOS = {
  esquerdo: { x: 46.97, y: 21.35 },
  direito: { x: 52.86, y: 21.42 },
  /** Diametro do nucleo, em vw. Casa com a pupila em tela cheia 16:9. */
  tamanho: 0.62,
}

/**
 * Linha dos labios azuis.
 *
 * Medido: extensao de 48.39% a 51.73% — largura real de apenas 3.35%.
 * Centro em 50.32% / 32.39%, altura ~1.1%.
 *
 * A primeira estimativa punha 8.6% de largura: 2.5x maior que o real, o
 * que faria as ondas vazarem pelas bochechas.
 */
export const BOCA = {
  x: 50.32,
  y: 32.4,
  /** Largura do grafico, em % da largura do quadro. */
  largura: 3.4,
  /** Altura maxima das barras, em % da altura do quadro. */
  altura: 2.6,
}

/**
 * Caixas de dados da MOVIKI.
 *
 * `atraso` e `duracao` dessincronizam os painéis: pulsando junto
 * pareceria defeito de render, nao sistema em operacao.
 */
export const PAINEIS = [
  // Esquerda
  { x: 1.5, y: 14.5, largura: 24.0, altura: 30.0, atraso: '0s', duracao: '4.2s' },   // NEGOCIOS NO MAPA
  { x: 1.5, y: 45.5, largura: 24.0, altura: 30.5, atraso: '1.6s', duracao: '5.3s' }, // PAGINAS DE NEGOCIOS
  // Direita
  { x: 75.0, y: 4.0, largura: 23.5, altura: 22.0, atraso: '0.7s', duracao: '4.6s' }, // MAPA EM TEMPO REAL
  { x: 75.0, y: 25.5, largura: 23.5, altura: 21.0, atraso: '2.2s', duracao: '5.1s' },// LOCALIZACOES ATIVAS
  { x: 75.0, y: 48.5, largura: 11.0, altura: 16.5, atraso: '1.1s', duracao: '3.9s' },// PROMOCOES
  { x: 86.5, y: 48.5, largura: 12.0, altura: 16.5, atraso: '2.7s', duracao: '4.8s' },// EVENTOS
  { x: 75.0, y: 65.5, largura: 11.0, altura: 14.0, atraso: '0.4s', duracao: '4.4s' },// RELATORIOS
  { x: 86.5, y: 65.5, largura: 12.0, altura: 14.0, atraso: '3.1s', duracao: '5.6s' },// VISIBILIDADE
]

/**
 * Pins luminosos sobre os tres mapas da composicao.
 *
 * Posicoes DETECTADAS por pixels (nucleo claro/verde/amarelo dos
 * marcadores), nao estimadas: a primeira tentativa a olho caiu em espaco
 * vazio do mapa. Blobs grandes (cartoes de foto, logo) filtrados por
 * tamanho.
 *
 * Duracoes nao-multiplas entre si, para o conjunto nunca cair em cadencia
 * unica — que leria como animacao em loop, nao como dado chegando.
 */
export const PONTOS_MAPA = [
  // Mapa do painel esquerdo (NEGOCIOS NO MAPA)
  { x: 4.5, y: 25.5, atraso: '0s', duracao: '2.3s' },
  { x: 9.2, y: 23.8, atraso: '0.9s', duracao: '3.1s' },
  { x: 11.2, y: 29.1, atraso: '1.7s', duracao: '2.7s' },
  { x: 11.1, y: 34.8, atraso: '2.4s', duracao: '3.4s' },
  { x: 17.3, y: 31.9, atraso: '1.3s', duracao: '2.9s' },
  { x: 8.6, y: 39.5, atraso: '3.0s', duracao: '3.6s' },
  // Mapa do painel direito (MAPA EM TEMPO REAL)
  { x: 79.3, y: 16.1, atraso: '0.4s', duracao: '2.9s' },
  { x: 81.2, y: 22.6, atraso: '1.2s', duracao: '3.3s' },
  { x: 85.9, y: 17.3, atraso: '2.0s', duracao: '2.5s' },
  { x: 88.4, y: 12.5, atraso: '2.8s', duracao: '3.7s' },
  { x: 92.9, y: 13.8, atraso: '0.6s', duracao: '3.0s' },
  // Mesa de controle (mapa inferior)
  { x: 35.5, y: 90.6, atraso: '0.2s', duracao: '2.6s' },
  { x: 41.1, y: 87.2, atraso: '1.5s', duracao: '3.2s' },
  { x: 56.7, y: 89.5, atraso: '2.5s', duracao: '2.8s' },
  { x: 67.4, y: 90.8, atraso: '1.9s', duracao: '3.5s' },
]
