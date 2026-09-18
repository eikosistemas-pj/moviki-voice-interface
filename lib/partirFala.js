// lib/partirFala.js  (repo: moviki-voice-interface)
//
// PARTIR A RESPOSTA EM PEDACOS PARA O ZEUS COMECAR A FALAR ANTES.
//
// O PROBLEMA — 18/09/2026
// O Paulo reclamou da demora entre falar e ouvir. Boa parte dela nao e o
// cerebro pensando: e a VOZ. A maquina tem UM processador, e o Kokoro so
// entrega o audio quando termina de sintetizar o pedaco INTEIRO. Dobrar o
// tamanho do pedaco dobra o tempo que o Zeus passa mudo.
//
// O ERRO QUE ESTAVA AQUI — 18/09/2026, segunda rodada
// A primeira versao usava UM alvo so, de 180 caracteres, para todos os
// pedacos — e com uma saida antecipada: texto ate 180 nao era partido.
//
// So que a instrucao do Zeus manda ele responder em DUAS OU TRES FRASES, o
// que quase sempre cabe em 180. Ou seja: na esmagadora maioria das respostas
// o partidor nao partia nada, e o Zeus continuava esperando a resposta
// INTEIRA virar audio antes de abrir a boca. O conserto da demora nao valia
// justamente nos casos mais comuns.
//
// A CORRECAO: O PRIMEIRO PEDACO E PEQUENO, OS SEGUINTES SAO MAIORES.
//
// So o PRIMEIRO pedaco esta no caminho critico. Os outros sao sintetizados
// enquanto o anterior toca, entao o tamanho deles nao custa espera — custa
// so nao ficar tao grande a ponto de a sintese nao acompanhar a fala.
//
// Uma resposta de duas frases que antes virava um pedaco de 210 caracteres
// hoje vira uma escada — 45, 72, 115... — e o Zeus abre a boca numa fracao do
// tempo. O tamanho dos degraus nao foi chutado: saiu da medicao da maquina do
// Paulo, logo abaixo.
//
// ONDE CORTAR
// Em fim de frase, nunca no meio. Corte no meio da frase faz a voz cair de
// entonacao e soar picotada — o remedio ficaria pior que a doenca.

/** Abaixo disso, um pedaco do MEIO vira suspiro: nao vale um pedido. */
export const MINIMO = 60

/**
 * O primeiro pode ser bem menor que os outros.
 *
 * Ele e o unico que o Paulo espera de boca fechada — e o piso e baixo DE
 * PROPOSITO, ate para uma palavra so.
 *
 * A TROCA QUE ISSO FAZ, ESCRITA COM TODAS AS LETRAS
 * "Terminei." sozinha faz o Zeus abrir a boca em cerca de 2 segundos em vez de
 * 6. Mas o pedaco seguinte e muito maior que ela, e a maquina nao consegue
 * prepara-lo no tempo em que uma palavra toca: sobra uma pausa de uns dois
 * segundos entre a primeira frase e o resto.
 *
 * Escolhido assim porque a reclamacao do Paulo e o tempo entre ELE falar e o
 * Zeus responder — nao o ritmo do meio da resposta. Pausa depois de uma
 * resposta comecada soa como alguem tomando folego; silencio de seis segundos
 * antes de qualquer som soa como robo quebrado.
 *
 * Se na pratica soar picotado, e esta linha que muda: subir para 30 volta a
 * juntar a abertura com a frase seguinte, e o comeco fica mais lento porem
 * sem pausa.
 */
export const MINIMO_PRIMEIRO = 8
export const ALVO_PRIMEIRO = 45

/** Teto: acima disso o pedaco demora tanto para sintetizar que atrasa a fila. */
export const ALVO_MAXIMO = 200

/**
 * OS PEDACOS CRESCEM EM ESCADA, E O DEGRAU TEM UMA RAZAO MEDIDA.
 *
 * Medido na VPS do Paulo em 18/09/2026 (`servidor/medir.sh`): 62 letras em
 * 3,1s e 180 letras em 8,2s. Disso sai a conta da maquina:
 *
 *   custo por letra ....... 0,043s
 *   custo fixo por pedido . 0,42s
 *   sintese ............... ~1,65x o tempo real da fala
 *
 * "1,65x o tempo real" quer dizer: enquanto um pedaco toca, da para preparar
 * um pedaco 1,65 vez maior. Se o seguinte for MAIOR que isso, a fila atrasa e
 * o Zeus cala no meio da resposta.
 *
 * ERA ESSE O ERRO DA VERSAO ANTERIOR DESTE ARQUIVO: primeiro pedaco de 18
 * letras e o seguinte de 170. O Zeus falava "Terminei o rodape." e ficava
 * SEIS SEGUNDOS E MEIO calado esperando o resto. Trocar espera no comeco por
 * buraco no meio nao e conserto, e mudanca de lugar do defeito.
 *
 * Por isso a escada: 45, 72, 115, 184, 200. Cada degrau e 1,6 vez o anterior
 * — o que a maquina consegue acompanhar — ate o teto.
 *
 * A razao 1,6 e conservadora de proposito. Em maquina mais rapida ela so
 * significa pedacos um pouco maiores que o necessario, que nao custa nada.
 */
const RAZAO = 1.6

export function alvoDoPedaco(indice) {
  return Math.min(Math.round(ALVO_PRIMEIRO * RAZAO ** indice), ALVO_MAXIMO)
}

export function pisoDoPedaco(indice) {
  return indice === 0 ? MINIMO_PRIMEIRO : MINIMO
}

/** Fim de frase de verdade: ponto, pergunta, exclamacao ou reticencia. */
const FIM_DE_FRASE = /(?<=[.!?…])\s+/

/**
 * Parte o texto em pedacos que terminam em fim de frase.
 *
 * O primeiro sai o menor que der; os seguintes juntam frases ate perto do
 * alvo, para nao picotar demais — cada pedaco e um pedido a mais ao servico
 * de voz, e pedido tem custo fixo.
 */
export function partirFala(texto) {
  const limpo = String(texto || '').trim()
  if (!limpo) return []
  // Cortar abaixo disso nao ganharia nada: o texto inteiro ja e um primeiro
  // pedaco pequeno.
  if (limpo.length <= ALVO_PRIMEIRO) return [limpo]

  // Corta DEPOIS da pontuacao, preservando-a: sem o ponto, a voz nao baixa a
  // entonacao no fim e as frases saem coladas.
  const frases = limpo.split(FIM_DE_FRASE)

  const pedacos = []
  let atual = ''

  for (const frase of frases) {
    if (!atual) {
      atual = frase
      continue
    }
    const alvo = alvoDoPedaco(pedacos.length)
    const piso = pisoDoPedaco(pedacos.length)
    const juntas = `${atual} ${frase}`

    // Junta quando ainda cabe no alvo — ou quando o que esta na mao ainda e
    // curto demais para sair sozinho. O teto de 2x evita que uma frase longa
    // logo depois de uma curtissima devolva um pedaco gigante.
    if (juntas.length <= alvo || (atual.length < piso && juntas.length <= alvo * 2)) {
      atual = juntas
    } else {
      pedacos.push(atual)
      atual = frase
    }
  }
  if (atual) pedacos.push(atual)

  // Um ultimo pedaco minusculo (um "Certo." solto) vira um pedido inteiro
  // para meio segundo de audio. Melhor colar no anterior. Vale so no fim: ali
  // ninguem esta esperando, entao juntar nao custa demora a ninguem.
  if (pedacos.length > 1 && pedacos[pedacos.length - 1].length < MINIMO) {
    const sobra = pedacos.pop()
    pedacos[pedacos.length - 1] = `${pedacos[pedacos.length - 1]} ${sobra}`
  }

  return pedacos
}
