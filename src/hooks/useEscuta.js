import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Reconhecimento de fala pelo proprio navegador (Web Speech API).
 *
 * Nao custa nada e nao manda audio para servidor nenhum. Funciona bem em
 * Chrome e Edge; o Firefox nao suporta, e por isso `suportado` existe:
 * a interface cai para digitacao em vez de quebrar.
 */
export function useEscuta({ idioma = 'pt-BR', aoFinalizar } = {}) {
  const [ouvindo, setOuvindo] = useState(false)
  const [parcial, setParcial] = useState('')
  const [erro, setErro] = useState(null)

  const recRef = useRef(null)
  const finalRef = useRef('')
  const callbackRef = useRef(aoFinalizar)

  useEffect(() => {
    callbackRef.current = aoFinalizar
  }, [aoFinalizar])

  const Reconhecimento =
    typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition)

  const suportado = Boolean(Reconhecimento)

  useEffect(() => {
    if (!suportado) return

    const rec = new Reconhecimento()
    rec.lang = idioma
    rec.continuous = false
    rec.interimResults = true

    rec.onresult = (evento) => {
      let texto = ''
      for (let i = evento.resultIndex; i < evento.results.length; i += 1) {
        texto += evento.results[i][0].transcript
      }
      setParcial(texto)
      if (evento.results[evento.results.length - 1].isFinal) {
        finalRef.current = texto.trim()
      }
    }

    rec.onerror = (evento) => {
      if (evento.error === 'not-allowed') {
        setErro('Permissao de microfone negada. Libere no navegador.')
      } else if (evento.error === 'no-speech') {
        setErro('Nao ouvi nada. Tente de novo.')
      } else if (evento.error !== 'aborted') {
        setErro(`Falha na escuta: ${evento.error}`)
      }
      setOuvindo(false)
    }

    rec.onend = () => {
      setOuvindo(false)
      const dito = finalRef.current
      finalRef.current = ''
      setParcial('')
      if (dito) callbackRef.current?.(dito)
    }

    recRef.current = rec
    return () => {
      rec.onresult = null
      rec.onerror = null
      rec.onend = null
      try {
        rec.abort()
      } catch {
        /* ja estava parado */
      }
    }
  }, [Reconhecimento, idioma, suportado])

  const comecar = useCallback(() => {
    if (!recRef.current || ouvindo) return
    setErro(null)
    setParcial('')
    finalRef.current = ''
    try {
      recRef.current.start()
      setOuvindo(true)
    } catch {
      /* start() reclama se chamado duas vezes; ignorar */
    }
  }, [ouvindo])

  const encerrar = useCallback(() => {
    if (!recRef.current) return
    try {
      recRef.current.stop()
    } catch {
      /* nada a parar */
    }
  }, [])

  return { comecar, encerrar, ouvindo, parcial, erro, suportado }
}
