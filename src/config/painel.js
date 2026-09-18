/**
 * Geometria e camadas animadas do painel do ZEUS.
 *
 * Tudo aqui e posicionado em PORCENTAGEM sobre a imagem `public/zeus.png`,
 * nunca em pixels: assim o alinhamento sobrevive a qualquer resolucao.
 *
 * ============================================================
 *  ATENCAO — ESTES VALORES AINDA NAO ESTAO CALIBRADOS.
 *
 *  Calibrar exige a imagem `zeus.png` em maos. Enquanto ela nao
 *  existir em `public/`, os numeros abaixo sao um PALPITE para um
 *  rosto centralizado em quadro 16:9.
 *
 *  COMO CALIBRAR (5 minutos, uma vez):
 *    1. suba o zeus.png para public/
 *    2. abra a interface com `?calibrar=1`
 *    3. aparecem miras magenta e uma grade de 10%
 *    4. ajuste os numeros deste arquivo ate cada mira cair
 *       exatamente sobre o alvo (pupila, labio, painel, ponto)
 *    5. recarregue sem `?calibrar=1`
 * ============================================================
 */

/** Caminho da imagem base. Vive em `public/`, servida na raiz. */
export const IMAGEM_ZEUS = '/zeus.png'

/** Pupilas mecanicas: centro de cada olho, em % do quadro. */
export const OLHOS = {
  esquerdo: { x: 43.2, y: 38.0 },
  direito: { x: 56.8, y: 38.0 },
  /** Diametro do nucleo de brilho, em vw. */
  tamanho: 2.6,
}

/** Linha dos labios: centro do grafico de ondas, em % do quadro. */
export const BOCA = {
  x: 50,
  y: 57.5,
  /** Largura total do grafico, em % da largura do quadro. */
  largura: 13,
  /** Altura maxima das barras, em % da altura do quadro. */
  altura: 6.5,
}

/**
 * Painéis laterais da MOVIKI (mapas, relatorios, paginas).
 *
 * Cada entrada desenha um contorno de brilho azul que respira, simulando
 * tela de dados sendo atualizada. `atraso` dessincroniza os painéis — sem
 * ele todos pulsariam juntos, o que parece defeito e nao atividade.
 */
export const PAINEIS = [
  { x: 6, y: 20, largura: 22, altura: 26, atraso: '0s', duracao: '4.2s' },
  { x: 6, y: 52, largura: 22, altura: 22, atraso: '1.4s', duracao: '5.1s' },
  { x: 72, y: 18, largura: 22, altura: 24, atraso: '0.7s', duracao: '4.6s' },
  { x: 72, y: 48, largura: 22, altura: 28, atraso: '2.1s', duracao: '5.6s' },
]

/**
 * Pontos luminosos sobre o mapa: atividade em tempo real.
 *
 * Duracoes propositalmente diferentes e nao-multiplas entre si, para o
 * conjunto nunca cair em cadencia unica.
 */
export const PONTOS_MAPA = [
  { x: 11, y: 28, atraso: '0s', duracao: '2.3s' },
  { x: 19, y: 34, atraso: '0.9s', duracao: '3.1s' },
  { x: 14, y: 39, atraso: '1.7s', duracao: '2.7s' },
  { x: 23, y: 26, atraso: '2.4s', duracao: '3.4s' },
  { x: 78, y: 25, atraso: '0.4s', duracao: '2.9s' },
  { x: 85, y: 31, atraso: '1.2s', duracao: '3.3s' },
  { x: 81, y: 37, atraso: '2.0s', duracao: '2.5s' },
  { x: 89, y: 22, atraso: '2.8s', duracao: '3.7s' },
]
