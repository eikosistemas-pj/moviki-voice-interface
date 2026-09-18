import { useEffect, useRef } from 'react'
import { ENDPOINT_CEREBRO } from '../config/voz'

/**
 * O Zeus chamando o Paulo quando termina um trabalho.
 *
 * POR QUE ISTO EXISTE — 18/09/2026
 * O trabalho corre por fora da conversa. Sem este aviso, o Paulo teria que
 * ficar espiando o repositorio de minuto em minuto, ou descobriria o Pull
 * Request muito depois. Robo que termina e nao avisa e pior que robo que nao
 * faz: pelo menos o que nao faz nao deixa trabalho esquecido.
 *
 * A TELA PERGUNTA, O SERVIDOR NAO EMPURRA
 * Navegador nao tem campainha. Perguntar de doze em doze segundos custa quase
 * nada — a rota nao pensa nem gasta chamada paga, so devolve o que ja estava
 * guardado. Montar um cano aberto so para isso seria peso a mais numa maquina
 * de 2 GB.
 *
 * ELE NAO CORTA A FALA DE NINGUEM
 * So avisa com o microfone fechado e com ele calado. Robo que fala por cima do
 * dono e robo que o dono desliga.
 */
const INTERVALO_MS = 12_000

export function useAviso({ cracha, ocupado, falar }) {
  // As duas em ref para o temporizador nao precisar ser refeito a cada
  // mudanca de estado — refazer a cada frame de conversa faria o aviso nunca
  // completar um ciclo.
  const ocupadoRef = useRef(ocupado)
  const falarRef = useRef(falar)

  useEffect(() => {
    ocupadoRef.current = ocupado
    falarRef.current = falar
  }, [ocupado, falar])

  useEffect(() => {
    if (!cracha) return undefined

    let vivo = true

    const espiar = async () => {
      // Com o Paulo falando, ou o Zeus falando, o aviso espera a proxima
      // volta. Novidade nao e urgente a ponto de atropelar conversa.
      if (!vivo || ocupadoRef.current) return

      try {
        const r = await fetch(
          `${ENDPOINT_CEREBRO}/novidade?cracha=${encodeURIComponent(cracha)}`
        )
        if (!r.ok) return
        const d = await r.json().catch(() => null)
        if (vivo && d?.fala) await falarRef.current?.(d.fala)
      } catch {
        // Servidor fora do ar ou internet oscilando: silencio e tenta de novo
        // na proxima volta. Ficar reclamando em voz alta de falha de rede
        // seria pior que o problema.
      }
    }

    const t = setInterval(espiar, INTERVALO_MS)
    return () => {
      vivo = false
      clearInterval(t)
    }
  }, [cracha])
}
