// lib/partirFala.js  (repo: moviki-voice-interface)
//
// PARTIR A RESPOSTA EM PEDACOS PARA O ZEUS COMECAR A FALAR ANTES.
//
// O PROBLEMA — 18/09/2026
// O Paulo reclamou da demora entre falar e ouvir. Boa parte dela nao e o
// cerebro pensando: e a VOZ. A maquina tem UM processador, e o Kokoro so
// entrega o audio quando termina de sintetizar a resposta INTEIRA. Quatro
// frases levam quatro vezes mais que uma — e o Paulo fica olhando para um
// robo mudo esse tempo todo.
//
// A SOLUCAO
// Partir a resposta em pedacos e sintetizar UM DE CADA VEZ, tocando o
// primeiro enquanto o segundo e preparado. O tempo total ate a ultima palavra
// e praticamente o mesmo; o tempo ate a PRIMEIRA e uma fracao. E o tempo ate
// a primeira e o que a pessoa chama de "demora".
//
// UM DE CADA VEZ, NAO TODOS JUNTOS
// Com um processador so, mandar quatro pedidos ao mesmo tempo faz os quatro
// brigarem pela mesma CPU e todos ficarem mais lentos. Enfileirado ganha.
//
// ONDE CORTAR
// Em fim de frase, nunca no meio. Corte no meio da frase faz a voz cair de
// entonacao e soar picotada — o remedio ficaria pior que a doenca.

/** Abaixo disso nao vale a pena cortar: o pedaco vira suspiro. */
const MINIMO = 60

/** Acima disso a espera pelo primeiro pedaco ja incomoda. */
const ALVO = 180

/**
 * Parte o texto em pedacos que terminam em fim de frase.
 *
 * Junta frases curtas ate chegar perto do alvo, para nao picotar demais: cada
 * pedaco e um pedido a mais ao servico de voz, e pedido tem custo fixo.
 */
export function partirFala(texto) {
  const limpo = String(texto || '').trim()
  if (!limpo) return []
  if (limpo.length <= ALVO) return [limpo]

  // Corta DEPOIS da pontuacao, preservando-a: sem o ponto, a voz nao baixa a
  // entonacao no fim e as frases saem coladas.
  const frases = limpo.split(/(?<=[.!?…])\s+/)

  const pedacos = []
  let atual = ''

  for (const frase of frases) {
    if (!atual) {
      atual = frase
      continue
    }
    if (`${atual} ${frase}`.length <= ALVO) {
      atual = `${atual} ${frase}`
    } else {
      pedacos.push(atual)
      atual = frase
    }
  }
  if (atual) pedacos.push(atual)

  // Um ultimo pedaco minusculo (um "Certo." solto) vira um pedido inteiro
  // para meio segundo de audio. Melhor colar no anterior.
  if (pedacos.length > 1 && pedacos[pedacos.length - 1].length < MINIMO) {
    const sobra = pedacos.pop()
    pedacos[pedacos.length - 1] = `${pedacos[pedacos.length - 1]} ${sobra}`
  }

  return pedacos
}
