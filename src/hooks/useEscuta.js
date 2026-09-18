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
  // Impede a frase de ser entregue duas vezes: uma no `isFinal` e outra no
  // `onend`, que vem logo atras.
  const entregueRef = useRef(false)
  const callbackRef = useRef(aoFinalizar)

  useEffect(() => {
    callbackRef.current = aoFinalizar
  }, [aoFinalizar])

  const Reconhecimento =
    typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition)

  /**
   * ENDERECO SEGURO — e a metade que faltava para o microfone do celular.
   *
   * 18/09/2026: o Paulo abriu no celular e o microfone nao funcionou. Nao e
   * defeito do Zeus nem do aparelho: navegador nenhum entrega microfone a uma
   * pagina sem cadeado. `localhost` e a unica excecao, e por isso no
   * computador dele as vezes funciona e no celular nunca.
   *
   * Sem esta conferencia, o botao simplesmente nao fazia nada — e botao morto
   * sem explicacao faz a pessoa achar que o robo quebrou.
   */
  const enderecoSeguro =
    typeof window === 'undefined' ||
    window.isSecureContext === true ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'

  const suportado = Boolean(Reconhecimento) && enderecoSeguro

  useEffect(() => {
    if (!suportado) return

    const rec = new Reconhecimento()
    rec.lang = idioma
    // false de proposito: a escuta morre no fim da frase. Metade da garantia
    // de que o Zeus nao fica com o microfone aberto — a outra metade e que so
    // o botao chama `comecar()`. Ver App.jsx, aoTocarMicrofone.
    rec.continuous = false
    rec.interimResults = true

    /**
     * Entrega a frase uma vez so.
     *
     * POR QUE NAO ESPERAR O `onend` — 18/09/2026, segunda rodada
     * O navegador so declara o fim da escuta depois de ouvir um tanto de
     * silencio. Esse silencio e tempo do Paulo: ele ja terminou de falar e
     * fica esperando o Chrome se convencer disso. A frase final ja esta na
     * mao no `isFinal` — dai para a frente esperar nao acrescenta nada.
     */
    const entregar = () => {
      setOuvindo(false)
      setParcial('')
      const dito = finalRef.current
      finalRef.current = ''
      if (!dito || entregueRef.current) return
      entregueRef.current = true
      callbackRef.current?.(dito)
    }

    rec.onresult = (evento) => {
      let texto = ''
      for (let i = evento.resultIndex; i < evento.results.length; i += 1) {
        texto += evento.results[i][0].transcript
      }
      setParcial(texto)
      if (evento.results[evento.results.length - 1].isFinal) {
        finalRef.current = texto.trim()
        // Fecha o microfone JA. Alem de ganhar tempo, e a leitura certa da
        // regra do Paulo: escuta que morre mais cedo e escuta menos aberta.
        try {
          rec.stop()
        } catch {
          /* ja estava parando */
        }
        entregar()
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

    // Rede de seguranca: se o navegador encerrar sem ter marcado nada como
    // final (fala curta, corte de audio), a frase ainda sai por aqui.
    rec.onend = entregar

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
    entregueRef.current = false
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

  return { comecar, encerrar, ouvindo, parcial, erro, suportado, enderecoSeguro }
}
