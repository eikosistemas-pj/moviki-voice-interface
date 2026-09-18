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

import { alvoDoPedaco, pisoDoPedaco } from './partirFala.js'

/** Fim de frase JA FECHADO: pontuacao com espaco depois. */
const FIM_FECHADO = /[.!?…]+["'”’)\]]*\s+/g

/**
 * Pontos de respiro: virgula, ponto-e-virgula, dois-pontos.
 *
 * QUANDO VALE CORTAR NUM RESPIRO — 18/09/2026, medido
 * A regra original era "so em fim de frase, nunca no meio". Ela continua
 * valendo no MEIO da resposta. Mas nos primeiros degraus da escada ela cria um
 * problema pior do que resolve:
 *
 * Se a resposta comeca com uma frase de 18 letras seguida de uma de 69, so com
 * fim de frase os pedacos sao 18 e 69 — e 69 e grande demais para a maquina
 * preparar enquanto 18 letras tocam. Resultado: dois segundos de silencio logo
 * depois da primeira frase. Cortar a segunda numa virgula derruba esse buraco
 * para menos de um segundo.
 *
 * Virgula nao e corte no meio: e uma pausa que a fala ja tem, e a pontuacao vai
 * junto no texto, entao a voz baixa a entonacao como deve. Corte em lugar
 * nenhum (no meio de um sintagma) continua proibido.
 */
const RESPIRO = /[,;:]\s+/g

/** Ate que degrau da escada vale usar respiro. Depois disso a fila ja alcancou. */
const DEGRAUS_COM_RESPIRO = 3

/**
 * Valvula de seguranca: se o modelo despejar isto tudo sem um unico ponto,
 * corta num respiro mesmo fora dos primeiros degraus.
 */
const SEM_PONTO_DEMAIS = 2

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
function ondeCortar(buffer, indice, final) {
  const alvo = alvoDoPedaco(indice)
  const piso = pisoDoPedaco(indice)
  const tamanho = (ate) => buffer.slice(0, ate).trim().length

  const fins = posicoesDe(buffer, FIM_FECHADO)
  const respiros = posicoesDe(buffer, RESPIRO)

  // O maior corte de FRASE que ainda cabe no alvo.
  let escolhido = null
  for (const p of fins) {
    if (tamanho(p) <= alvo) escolhido = p
    else break
  }

  if (escolhido === null) {
    // Nenhuma frase inteira cabe no alvo. Nos primeiros degraus, um respiro
    // que caiba vale mais que um pedaco grande demais — ver o comentario do
    // RESPIRO la em cima.
    const esticado = buffer.trim().length > alvo * SEM_PONTO_DEMAIS
    if ((indice < DEGRAUS_COM_RESPIRO || esticado) && respiros.length) {
      const cabe = respiros.filter((p) => tamanho(p) <= alvo && tamanho(p) >= piso)
      if (cabe.length) return cabe[cabe.length - 1]
      // Nenhum respiro cabe no alvo e nao ha nem fim de frase a vista: o
      // primeiro respiro, mesmo grande, e melhor que o Zeus mudo acumulando.
      if (!fins.length && esticado) return respiros[0]
    }
    // Sem respiro utilizavel: a primeira frase sai inteira, mesmo passando do
    // alvo. Cortar no meio dela seria pior.
    if (fins.length) escolhido = fins[0]
    else return final && buffer.trim() ? buffer.length : null
  }

  if (tamanho(escolhido) < piso) {
    // Curto demais para sair sozinho. Estica ate a proxima frase se isso nao
    // fizer um pedaco grande demais; senao espera chegar mais texto.
    const proximo = fins[fins.indexOf(escolhido) + 1]
    if (proximo !== undefined && tamanho(proximo) <= alvo * 2) {
      escolhido = proximo
    } else if (!final) {
      return null
    } else if (buffer.trim().length <= alvo * 3) {
      // FIM DO TEXTO, E O QUE ESTA NA MAO E UM TOCO.
      //
      // Era aqui que o "Sim." continuava saindo sozinho mesmo com o piso alto:
      // no fim nao existe "proxima frase" para esticar, entao ele caia direto e
      // soltava as quatro letras. O resto vinha logo atras, e entre um e outro
      // ficava a pausa de quatro segundos que o Paulo ouviu.
      //
      // No fim nao ha o que esperar: leva TUDO o que sobrou de uma vez.
      return buffer.length
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
      const corte = ondeCortar(buffer, saidos, final)
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
