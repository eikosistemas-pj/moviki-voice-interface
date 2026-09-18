import { useCallback, useMemo, useState } from 'react'
import PainelZeus from './components/PainelZeus'
import BotaoMicrofone from './components/BotaoMicrofone'
import { useVozZeus } from './hooks/useVozZeus'
import { useEscuta } from './hooks/useEscuta'
import { detectarHumor } from './lib/humor'
import { ESTADOS, HUMORES } from './config/voz'

/**
 * ZEUS — painel de voz.
 *
 * A imagem `public/zeus.png` e a base da tela; por cima dela vivem as
 * camadas animadas (olhos pulsando, boca audio-reativa). Sem seletor de
 * voz, sem transcrito, sem cabecalho: a voz e travada em codigo
 * (`VOZ_FIXA` em config/voz.js) e a tela mostra o robo e o microfone.
 *
 * Parametros de URL para revisao:
 *   ?humor=firmeza|impaciencia|entusiasmo|feliz   forca a expressao
 *   ?calibrar=1                                   miras sobre olhos/boca
 */
export default function App() {
  const [humor, setHumor] = useState(HUMORES.NEUTRO)
  const [pensando, setPensando] = useState(false)

  const { humorForcado, calibrar } = useMemo(() => {
    if (typeof window === 'undefined') return { humorForcado: null, calibrar: false }
    const q = new URLSearchParams(window.location.search)
    const pedido = q.get('humor')
    return {
      humorForcado:
        pedido && Object.values(HUMORES).includes(pedido) ? pedido : null,
      calibrar: q.get('calibrar') === '1',
    }
  }, [])

  const {
    falar,
    parar,
    falando,
    carregando,
    erro: erroVoz,
    nivelRef,
  } = useVozZeus()

  /**
   * Onde o cerebro entra.
   *
   * Hoje devolve uma resposta de exemplo: esta interface e a camada
   * visual, e o atendente de verdade mora no `moviki-ai`. Trocar este
   * corpo por um fetch para `/api/atendimento` liga os dois — o humor
   * continua saindo do texto, sem mudanca aqui.
   */
  const responder = useCallback(
    async (textoDaPessoa) => {
      setPensando(true)
      setHumor(HUMORES.NEUTRO)

      try {
        await new Promise((r) => setTimeout(r, 600))
        const resposta =
          `Ainda nao estou ligado ao atendente do Moviki. ` +
          `Voce disse: ${textoDaPessoa}`

        // Humor definido ANTES de falar: a expressao precisa estar no
        // rosto no instante em que a voz comeca, nao depois.
        setHumor(detectarHumor(resposta))
        setPensando(false)
        await falar(resposta)
      } catch {
        setPensando(false)
        setHumor(HUMORES.FIRMEZA)
      }
    },
    [falar]
  )

  const { comecar, encerrar, ouvindo, erro: erroEscuta, suportado } = useEscuta({
    aoFinalizar: responder,
  })

  const estado = useMemo(() => {
    if (erroVoz || erroEscuta) return ESTADOS.ERRO
    if (ouvindo) return ESTADOS.OUVINDO
    if (pensando || carregando) return ESTADOS.PENSANDO
    if (falando) return ESTADOS.FALANDO
    return ESTADOS.PARADO
  }, [carregando, erroEscuta, erroVoz, falando, ouvindo, pensando])

  // Em erro o rosto assume firmeza: o proprio Zeus comunica o problema,
  // sem caixa de texto vermelha poluindo a tela.
  const humorVisivel =
    humorForcado || (estado === ESTADOS.ERRO ? HUMORES.FIRMEZA : humor)

  const aoTocarMicrofone = () => {
    if (falando || carregando) {
      parar()
      return
    }
    if (ouvindo) {
      encerrar()
      return
    }
    comecar()
  }

  return (
    <main className="relative h-full w-full overflow-hidden bg-movic-obsidiana">
      {/* Base: imagem do Zeus + camadas animadas. */}
      <div className="absolute inset-0">
        <PainelZeus
          estado={estado}
          humor={humorVisivel}
          nivelRef={nivelRef}
          calibrar={calibrar}
        />
      </div>

      {/* Microfone integrado a armadura, na base da tela. */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center pb-8 sm:pb-10">
        {/* Trilho de luz que ancora o botao a estrutura. */}
        <div className="mb-4 h-px w-56 bg-gradient-to-r from-transparent via-movic-neon/45 to-transparent" />

        <div className="relative flex items-center justify-center">
          {/* Plataforma metalica sob o botao. */}
          <div className="absolute h-24 w-44 rounded-[2rem] border border-white/[0.07] bg-gradient-to-b from-[#141b28]/85 to-[#0a0e16]/90 backdrop-blur-sm" />
          <div className="absolute h-24 w-44 rounded-[2rem] bg-movic-neon/[0.06] blur-xl" />

          <div className="relative">
            <BotaoMicrofone
              estado={estado}
              desabilitado={!suportado}
              onClick={aoTocarMicrofone}
            />
          </div>
        </div>

        {/*
          Unico aviso que sobrevive ao minimalismo: sem reconhecimento de
          fala o microfone nao faz nada, e botao morto sem explicacao e
          pior que uma linha de texto.
        */}
        {!suportado && (
          <p className="mt-4 text-center text-[11px] tracking-wide text-movic-neon/50">
            Este navegador nao reconhece fala. Use Chrome ou Edge.
          </p>
        )}
      </div>
    </main>
  )
}
