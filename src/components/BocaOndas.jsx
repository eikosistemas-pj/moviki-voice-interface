import { useEffect, useRef } from 'react'
import { ESTADOS } from '../config/voz'

/**
 * Grafico de ondas sonoras da boca do Zeus.
 *
 * As barras sao escritas direto nos atributos do SVG por
 * `requestAnimationFrame`, lendo `nivelRef` (amplitude real do audio,
 * 0..1, medida por AnalyserNode no hook da voz). Nao passa por state:
 * 17 barras a 60fps re-renderizariam a arvore inteira 60 vezes por
 * segundo.
 *
 * Reutilizavel: serve sobre a imagem `zeus.png` e tambem sobre o rosto
 * SVG de reserva.
 */

/** Numero de barras. Impar, para existir uma barra central. */
const BARRAS = 17

export default function BocaOndas({ estado, nivelRef, cor = '#38bdf8', agitacao = 1 }) {
  const falando = estado === ESTADOS.FALANDO
  const ouvindo = estado === ESTADOS.OUVINDO
  const pensando = estado === ESTADOS.PENSANDO

  const barrasRef = useRef([])
  const rafRef = useRef(null)

  // `agitacao` entra por ref, nao como dependencia do efeito: como
  // dependencia, cada troca de humor cancelaria e recriaria o loop de
  // animacao no meio da fala, causando um salto visivel nas barras.
  const agitacaoRef = useRef(agitacao)
  useEffect(() => {
    agitacaoRef.current = agitacao
  }, [agitacao])

  useEffect(() => {
    const barras = barrasRef.current

    const desenhar = () => {
      const nivel = falando ? nivelRef?.current || 0 : 0
      const agora = performance.now()

      for (let i = 0; i < barras.length; i += 1) {
        const barra = barras[i]
        if (!barra) continue

        let altura
        if (falando) {
          // Centro responde mais que as pontas: forma de onda de voz.
          const centro = (BARRAS - 1) / 2
          const distancia = Math.abs(i - centro) / centro
          const peso = 1 - distancia * 0.62
          // Defasagem por barra: a onda anda, em vez de pular em bloco.
          // `agitacao` vem do humor: firmeza/entusiasmo agitam mais, a
          // impaciencia contem — sempre sobre a amplitude REAL do audio,
          // nunca inventando movimento onde nao ha som.
          const onda = 0.72 + 0.28 * Math.sin(agora / 95 + i * 0.85)
          altura = 1.6 + nivel * peso * onda * 22 * agitacaoRef.current
        } else if (ouvindo) {
          // Escutando: linha viva mas discreta — nao simula fala.
          altura = 1.6 + 1.5 * Math.abs(Math.sin(agora / 420 + i * 0.5))
        } else if (pensando) {
          // Pensando: pulso caminhando da esquerda para a direita.
          const fase = (agora / 260 + i * 0.5) % (Math.PI * 2)
          altura = 1.6 + 3.2 * Math.max(0, Math.sin(fase))
        } else {
          altura = 1.6
        }

        barra.setAttribute('height', altura.toFixed(2))
        barra.setAttribute('y', (-altura / 2).toFixed(2))
      }

      rafRef.current = requestAnimationFrame(desenhar)
    }

    rafRef.current = requestAnimationFrame(desenhar)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [falando, ouvindo, pensando, nivelRef])

  const largura = 100
  const espaco = largura / (BARRAS + 1)

  return (
    <svg
      viewBox="0 0 100 52"
      preserveAspectRatio="none"
      className="h-full w-full overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <filter id="brilhoBoca" x="-70%" y="-70%" width="240%" height="240%">
          <feGaussianBlur stdDeviation="1.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g transform="translate(0 26)" filter="url(#brilhoBoca)">
        {Array.from({ length: BARRAS }).map((_, i) => {
          const x = espaco * (i + 1)
          return (
            <rect
              key={i}
              ref={(el) => {
                barrasRef.current[i] = el
              }}
              x={x - 1}
              y={-0.8}
              width={2}
              height={1.6}
              rx={1}
              fill={cor}
            />
          )
        })}
      </g>
    </svg>
  )
}
