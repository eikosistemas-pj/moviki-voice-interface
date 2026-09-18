import { Loader2, Mic, Square } from 'lucide-react'
import { ESTADOS } from '../config/voz'

/**
 * Microfone integrado a base metalica do painel.
 *
 * Grande e circular: e o unico controle da tela, entao nao precisa
 * competir com nada. O anel externo muda de cor conforme o estado, o que
 * substitui qualquer legenda de texto.
 */
export default function BotaoMicrofone({ estado, desabilitado, onClick }) {
  const ouvindo = estado === ESTADOS.OUVINDO
  const pensando = estado === ESTADOS.PENSANDO
  const falando = estado === ESTADOS.FALANDO

  let Icone = Mic
  let rotulo = 'Falar com o Zeus'
  if (ouvindo) {
    Icone = Square
    rotulo = 'Parar de falar'
  } else if (pensando) {
    Icone = Loader2
    rotulo = 'Zeus esta processando'
  } else if (falando) {
    Icone = Square
    rotulo = 'Interromper o Zeus'
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desabilitado}
      aria-label={rotulo}
      title={rotulo}
      className={`group relative flex h-20 w-20 items-center justify-center rounded-full border-2 transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-movic-neon focus-visible:ring-offset-2 focus-visible:ring-offset-movic-obsidiana disabled:cursor-not-allowed disabled:opacity-35 ${
        ouvindo
          ? 'border-movic-eletrico bg-movic-eletrico/15 text-movic-eletrico shadow-[0_0_28px_rgba(34,211,238,0.5)]'
          : falando || pensando
            ? 'border-movic-neon/70 bg-movic-neon/10 text-movic-neon shadow-[0_0_22px_rgba(56,189,248,0.35)]'
            : 'border-movic-neon/35 bg-white/[0.03] text-movic-neon/80 hover:border-movic-neon/70 hover:bg-movic-neon/10 hover:shadow-[0_0_22px_rgba(56,189,248,0.3)]'
      }`}
    >
      <Icone size={28} className={pensando ? 'animate-spin' : ''} />
    </button>
  )
}
