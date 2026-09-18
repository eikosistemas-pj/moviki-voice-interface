// lib/fluxoFala.js  (repo: moviki-voice-interface)
//
// PARTIR A RESPOSTA ENQUANTO ELA AINDA ESTA SENDO ESCRITA.
//
// POR QUE ISTO EXISTE — 18/09/2026
// `lib/partirFala.js` parte um texto que ja existe inteiro. Mas o cerebro
// agora chega em fluxo, palavra por palavra (ver servidor/cerebro.js), e
// esperar a ultima palavra para so entao comecar a virar audio joga fora
// justamente o tempo que a gente esta tentando economizar.
//
// Este arquivo faz o mesmo trabalho com o texto chegando aos poucos: recebe
// os pedacos crus do modelo e devolve FRASES INTEIRAS assim que elas ficam
// prontas, para a voz comecar a sintetizar a primeira enquanto o modelo ainda
// escreve a segunda.
//
// A CONTA QUE ISSO MUDA
// Antes:  [pensa a resposta inteira] -> [sintetiza o primeiro pedaco] -> fala
// Agora:  [pensa a primeira frase]   -> [sintetiza o primeiro pedaco] -> fala
//                                       (e o resto corre escondido atras)
//
// UM PEDACO SO SAI QUANDO A FRASE ACABOU
// O corte exige pontuacao SEGUIDA DE ESPACO. Enquanto o modelo nao escreveu
// o que vem depois do ponto, nao ha corte — e e proposital: "R$ 79." e
// "versao 4.5" tem ponto no meio, e cortar ali faria a voz frear no meio de
// um numero.

import {
  ALVO,
  ALVO_PRIMEIRO,
  MINIMO,
  MINIMO_PRIMEIRO,
} from './partirFala.js'

/** Fim de frase JA FECHADO: pontuacao com espaco depois. */
const FIM_FECHADO = /[.!?…]+["'”’)\]]*\s+/g

/**
 * Valvula de seguranca: se o modelo despejar isto tudo sem um unico ponto,
 * e melhor cortar numa virgula do que deixar o Zeus mudo esperando.
 */
const SEM_PONTO_DEMAIS = 2

/** Pontos de respiro aceitaveis quando nao existe fim de frase nenhum. */
const RESPIRO = /[,;:]\s+/g

function posicoesDe(texto, expressao) {
  const achados = []
  const re = new RegExp(expressao.source, 'g')
  let m
  while ((m = re.exec(texto)) !== null) {
    achados.push(m.index + m[0].length)
    if (m.index === re.lastIndex) re.lastIndex += 1
  }
  return achados
}

/**
 * Onde cortar o comeco do buffer, ou `null` se ainda vale esperar.
 *
 * `final` = o modelo ja terminou, entao nao ha mais o que esperar e o que
 * sobrou sai como esta.
 */
function ondeCortar(buffer, primeiro, final) {
  const alvo = primeiro ? ALVO_PRIMEIRO : ALVO
  const piso = primeiro ? MINIMO_PRIMEIRO : MINIMO
  const tamanho = (ate) => buffer.slice(0, ate).trim().length

  const fins = posicoesDe(buffer, FIM_FECHADO)

  if (!fins.length) {
    if (final) return buffer.trim() ? buffer.length : null
    // Sem nenhum fim de frase a vista e o texto ja bem passado do alvo:
    // corta num respiro. Virgula nao e tao boa quanto ponto, mas silencio
    // comprido e pior que uma entonacao menos redonda.
    if (buffer.trim().length > alvo * SEM_PONTO_DEMAIS) {
      const respiros = posicoesDe(buffer, RESPIRO).filter((p) => tamanho(p) <= alvo)
      if (respiros.length) return respiros[respiros.length - 1]
    }
    return null
  }

  // O maior corte que ainda cabe no alvo. Se nem a primeira frase couber,
  // ela sai inteira: cortar no meio dela seria pior.
  let escolhido = null
  for (const p of fins) {
    if (tamanho(p) <= alvo) escolhido = p
    else break
  }
  if (escolhido === null) escolhido = fins[0]

  if (tamanho(escolhido) < piso) {
    // Curto demais para sair sozinho. Estica ate a proxima frase se isso nao
    // fizer um pedaco gigante; senao espera chegar mais texto.
    const proximo = fins[fins.indexOf(escolhido) + 1]
    if (proximo !== undefined && tamanho(proximo) <= alvo * 2) {
      escolhido = proximo
    } else if (!final) {
      return null
    }
  }

  return escolhido
}

/**
 * Cria o acumulador.
 *
 *   const fluxo = criarFluxoFala()
 *   fluxo.empurrar('Assumi o posto. Vou to')  -> ['Assumi o posto.']
 *   fluxo.empurrar('cando e te aviso.')       -> []
 *   fluxo.encerrar()                          -> ['Vou tocando e te aviso.']
 *
 * As duas devolvem SEMPRE uma lista (vazia quando nada ficou pronto), para
 * quem chama nunca precisar testar nulo.
 */
export function criarFluxoFala() {
  let buffer = ''
  let saidos = 0

  const colher = (final) => {
    const prontos = []
    for (;;) {
      const corte = ondeCortar(buffer, saidos === 0, final)
      if (corte === null) break
      const pedaco = buffer.slice(0, corte).trim()
      buffer = buffer.slice(corte)
      if (!pedaco) continue
      prontos.push(pedaco)
      saidos += 1
    }
    return prontos
  }

  return {
    empurrar(texto) {
      buffer += String(texto || '')
      return colher(false)
    },
    encerrar() {
      const resto = colher(true)
      buffer = ''
      return resto
    },
  }
}
