import { useCallback, useEffect, useRef, useState } from 'react'
import { partirFala } from '../../lib/partirFala'
import { ajustarPronuncia } from '../../lib/pronuncia'
import {
  ENDPOINT_TTS,
  IDIOMA_VOZ,
  VELOCIDADE_VOZ,
  VOZ_FIXA,
} from '../config/voz'

/**
 * Fala do Zeus + amplitude real do audio para a boca reagir.
 *
 * A boca precisa oscilar no ritmo EXATO da fala. Por isso o audio passa por
 * um AnalyserNode da Web Audio API: a cada frame lemos a energia do sinal e
 * expomos em `nivelRef` (0..1). O componente da boca le essa ref dentro do
 * seu proprio requestAnimationFrame — nao usamos state por frame, que
 * causaria ~60 re-renders por segundo em toda a arvore.
 *
 * `createMediaElementSource` exige mesma origem (ou CORS): o audio vem de
 * `/api/voz`, no mesmo dominio, entao a analise e permitida. Se o
 * AudioContext falhar, a fala continua e a boca cai para uma oscilacao
 * sintetica — o Zeus nunca fica mudo por causa do visual.
 */
export function useVozZeus() {
  const [falando, setFalando] = useState(false)
  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState(null)

  const audioRef = useRef(null)
  const urlRef = useRef(null)
  const abortRef = useRef(null)

  // Web Audio: criados uma vez e reaproveitados. Um AudioContext por fala
  // estouraria o limite do navegador (~6) em poucas respostas.
  const ctxRef = useRef(null)
  const analiseRef = useRef(null)
  const origemRef = useRef(null)
  const bufferRef = useRef(null)
  const rafRef = useRef(null)

  /** Nivel de energia do audio, 0..1. Lido por frame pela boca. */
  const nivelRef = useRef(0)

  const limparUrl = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }
  }, [])

  const pararMedicao = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    nivelRef.current = 0
  }, [])

  const parar = useCallback(() => {
    abortRef.current?.abort()
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    pararMedicao()
    limparUrl()
    setFalando(false)
    setCarregando(false)
  }, [limparUrl, pararMedicao])

  /**
   * Liga o elemento <audio> ao analisador.
   *
   * O mesmo elemento e reusado em todas as falas justamente porque
   * `createMediaElementSource` pode ser chamado UMA vez por elemento —
   * chamar de novo lanca InvalidStateError.
   */
  const ligarAnalise = useCallback((elemento) => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext
      if (!Ctx) return false

      if (!ctxRef.current) {
        ctxRef.current = new Ctx()
        const analise = ctxRef.current.createAnalyser()
        // Janela curta: resposta rapida, que e o que a boca precisa.
        analise.fftSize = 256
        analise.smoothingTimeConstant = 0.55
        analiseRef.current = analise
        bufferRef.current = new Uint8Array(analise.fftSize)
      }

      if (!origemRef.current) {
        origemRef.current = ctxRef.current.createMediaElementSource(elemento)
        origemRef.current.connect(analiseRef.current)
        // Precisa seguir para os alto-falantes, senao o audio fica inaudivel.
        analiseRef.current.connect(ctxRef.current.destination)
      }

      // Navegador suspende o contexto ate haver interacao do usuario.
      if (ctxRef.current.state === 'suspended') ctxRef.current.resume()
      return true
    } catch {
      return false
    }
  }, [])

  /** Mede a amplitude por frame (RMS) enquanto o audio toca. */
  const medir = useCallback((sintetico) => {
    const passo = () => {
      if (sintetico || !analiseRef.current || !bufferRef.current) {
        // Sem Web Audio: oscilacao plausivel para a boca nao ficar parada.
        const t = performance.now() / 1000
        nivelRef.current =
          0.34 + 0.3 * Math.abs(Math.sin(t * 7.3)) + 0.16 * Math.abs(Math.sin(t * 3.1))
      } else {
        analiseRef.current.getByteTimeDomainData(bufferRef.current)
        let soma = 0
        for (let i = 0; i < bufferRef.current.length; i += 1) {
          const v = (bufferRef.current[i] - 128) / 128
          soma += v * v
        }
        const rms = Math.sqrt(soma / bufferRef.current.length)
        // Fala normalizada vive em RMS baixo; o ganho traz para 0..1 visual.
        nivelRef.current = Math.min(1, rms * 3.4)
      }
      rafRef.current = requestAnimationFrame(passo)
    }
    rafRef.current = requestAnimationFrame(passo)
  }, [])

  /** Manda um pedaco para o servico de voz e devolve o audio pronto. */
  const sintetizar = useCallback(async (pedaco, signal) => {
    const resposta = await fetch(ENDPOINT_TTS, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // Passa pelo dicionario de pronuncia: nome de marca e palavra
        // estrangeira vao escritos do jeito que devem SOAR, senao a voz le
        // "Enterprise" pelas regras do portugues. Ninguem le este texto — ele
        // so existe no caminho ate o motor de voz.
        texto: ajustarPronuncia(pedaco),
        voz: VOZ_FIXA,
        idioma: IDIOMA_VOZ,
        velocidade: VELOCIDADE_VOZ,
      }),
    })
    if (!resposta.ok) {
      const detalhe = await resposta.text().catch(() => '')
      throw new Error(
        `A voz do Zeus nao respondeu (${resposta.status}). ${detalhe.slice(0, 140)}`
      )
    }
    return URL.createObjectURL(await resposta.blob())
  }, [])

  /** Toca um pedaco ate o fim. */
  const tocar = useCallback(
    (audio, url) =>
      new Promise((resolve, reject) => {
        audio.onended = resolve
        audio.onerror = () => reject(new Error('O navegador nao conseguiu tocar o audio.'))
        audio.src = url
        audio.play().catch(reject)
      }),
    []
  )

  /**
   * Fala a resposta inteira, em pedacos, comecando antes de ela estar pronta.
   *
   * POR QUE EM PEDACOS — 18/09/2026
   * O Paulo reclamou da demora entre falar e ouvir. Boa parte dela nao era o
   * cerebro pensando: era a voz. A maquina tem um processador so, e o Kokoro
   * so devolve o audio quando termina a resposta INTEIRA — quatro frases
   * levam quatro vezes mais que uma, e nesse tempo todo o Zeus fica mudo.
   *
   * Agora cada pedaco e sintetizado enquanto o anterior toca. O tempo ate a
   * ULTIMA palavra e quase o mesmo; o tempo ate a PRIMEIRA cai para uma
   * fracao. E e o tempo ate a primeira que a pessoa chama de "demora".
   *
   * UM DE CADA VEZ, de proposito: com um processador so, mandar todos os
   * pedidos juntos faz os pedacos brigarem pela mesma CPU e todos chegarem
   * mais tarde.
   */
  const falar = useCallback(
    async (texto) => {
      if (!texto?.trim()) return

      parar()
      setErro(null)
      setCarregando(true)

      const controller = new AbortController()
      abortRef.current = controller

      const pedacos = partirFala(texto)
      if (!audioRef.current) audioRef.current = new Audio()
      const audio = audioRef.current
      const comAnalise = ligarAnalise(audio)

      // A sintese do pedaco seguinte ja esta em andamento enquanto o atual
      // toca. Se o Paulo mandar parar no meio, ela e abortada — e a rejeicao
      // precisa de dono, senao o navegador reclama de promessa solta.
      let emPreparo = sintetizar(pedacos[0], controller.signal)

      try {
        for (let i = 0; i < pedacos.length; i += 1) {
          const url = await emPreparo

          emPreparo =
            i + 1 < pedacos.length
              ? sintetizar(pedacos[i + 1], controller.signal)
              : null
          emPreparo?.catch(() => null)

          if (controller.signal.aborted) {
            URL.revokeObjectURL(url)
            return
          }

          if (i === 0) {
            setCarregando(false)
            setFalando(true)
            medir(!comAnalise)
          }

          urlRef.current = url
          await tocar(audio, url)
          limparUrl()
        }

        pararMedicao()
        setFalando(false)
      } catch (e) {
        if (e.name === 'AbortError' || controller.signal.aborted) return
        pararMedicao()
        setErro(e.message)
        setFalando(false)
        setCarregando(false)
      }
    },
    [ligarAnalise, limparUrl, medir, parar, pararMedicao, sintetizar, tocar]
  )

  useEffect(
    () => () => {
      abortRef.current?.abort()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
      ctxRef.current?.close?.()
    },
    []
  )

  return { falar, parar, falando, carregando, erro, nivelRef }
}
