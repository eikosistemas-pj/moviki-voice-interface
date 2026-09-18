import { useCallback, useMemo, useState } from 'react'
import PainelZeus from './components/PainelZeus'
import BotaoMicrofone from './components/BotaoMicrofone'
import { useVozZeus } from './hooks/useVozZeus'
import { useEscuta } from './hooks/useEscuta'
import { detectarHumor } from './lib/humor'
import { ENDPOINT_CEREBRO, ESTADOS, HUMORES, TOKEN_ZEUS } from './config/voz'

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
   * A tela NAO decide nada: manda o que foi falado para o servidor do Zeus
   * (servidor/zeus.js, na VPS) e fala o que voltar. A trava do turno vive la,
   * porque o que roda no navegador qualquer um edita com o console aberto.
   *
   * O token e so um tapa-buraco de porta — ele viaja para o navegador e
   * qualquer um consegue ler no codigo da pagina. Quem segura o prejuizo de
   * verdade e o teto diario, do lado do servidor.
   */
  const responder = useCallback(
    async (textoDaPessoa) => {
      setPensando(true)
      setHumor(HUMORES.NEUTRO)

      try {
        const r = await fetch(ENDPOINT_CEREBRO, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texto: textoDaPessoa, token: TOKEN_ZEUS }),
        })

        // Mesmo em 401 ou 400 o servidor manda uma frase para o Zeus falar:
        // robo mudo nao explica o que houve, e ai a culpa sobra para a voz.
        const dados = await r.json().catch(() => null)
        const resposta =
          dados?.resposta || 'Nao consegui falar com o meu servidor agora.'

        // Humor definido ANTES de falar: a expressao precisa estar no
        // rosto no instante em que a voz comeca, nao depois.
        setHumor(detectarHumor(resposta))
        setPensando(false)
        await falar(resposta)
      } catch {
        setPensando(false)
        setHumor(HUMORES.FIRMEZA)
        await falar('Nao consegui falar com o meu servidor agora.')
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

  /**
   * O UNICO lugar do sistema que liga o microfone.
   *
   * REGRA DO PAULO (18/09/2026): o Zeus nao aciona o microfone sozinho. Quem
   * abre o microfone e ele, com o dedo, quando quer falar.
   *
   * Nao existe escuta continua, nao existe "volta a ouvir depois de
   * responder", nao existe palavra de despertar. A melhoria obvia que alguem
   * vai querer fazer um dia — reabrir a escuta sozinho quando o Zeus termina
   * de falar — e justamente a que NAO pode ser feita: um robo com o
   * microfone na mao e um microfone aberto na casa do dono.
   *
   * O `continuous = false` em useEscuta.js e a outra metade dessa garantia:
   * a escuta morre sozinha no fim da frase.
   */
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
