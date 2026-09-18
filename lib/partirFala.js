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
// hoje vira um de 40 e outro de 170: o Zeus abre a boca em uma fracao do
// tempo, e a segunda parte fica pronta enquanto a primeira toca.
//
// ONDE CORTAR
// Em fim de frase, nunca no meio. Corte no meio da frase faz a voz cair de
// entonacao e soar picotada — o remedio ficaria pior que a doenca.

/** Abaixo disso, um pedaco do MEIO vira suspiro: nao vale um pedido. */
export const MINIMO = 60

/**
 * O primeiro pode ser bem menor que os outros.
 *
 * Ele e o unico que o Paulo espera de boca fechada, entao aqui pequeno e
 * bom: uma frase curta de verdade ("Terminei o rodape.") deve sair sozinha e
 * na hora. O piso e baixo de proposito — ele existe so para uma interjeicao
 * ("Certo.", "Pronto.") nao virar um pedido inteiro ao motor de voz para meio
 * segundo de audio.
 */
export const MINIMO_PRIMEIRO = 16
export const ALVO_PRIMEIRO = 90

/**
 * Os seguintes sao maiores, mas nao enormes.
 *
 * Eles correm por fora, escondidos atras da fala do anterior — mas se um
 * pedaco de audio demorar mais para ser sintetizado do que o anterior demora
 * para ser falado, a fila atrasa e aparece silencio no meio da frase.
 */
export const ALVO = 170

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
    const primeiro = pedacos.length === 0
    const alvo = primeiro ? ALVO_PRIMEIRO : ALVO
    const piso = primeiro ? MINIMO_PRIMEIRO : MINIMO
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
