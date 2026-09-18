import { useCallback, useMemo, useState } from 'react'
import PainelZeus from './components/PainelZeus'
import BotaoMicrofone from './components/BotaoMicrofone'
import TelaEntrada from './components/TelaEntrada'
import { useVozZeus } from './hooks/useVozZeus'
import { useEscuta } from './hooks/useEscuta'
import { useEntrada } from './hooks/useEntrada'
import { useAviso } from './hooks/useAviso'
import { detectarHumor } from './lib/humor'
import { lerLinhas } from '../lib/ndjson'
import { ENDPOINT_CEREBRO, ESTADOS, HUMORES } from './config/voz'

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
  const entrada = useEntrada()

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
    falarFluxo,
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
   * Vai o CRACHA, nao a senha: a senha atravessa a rede uma vez so, na
   * entrada. Se o servidor recusar o cracha (venceu, ou o Zeus reiniciou), a
   * tela esquece e pede a senha de novo em vez de ficar falando sozinha.
   *
   * A RESPOSTA CHEGA AOS POUCOS — 18/09/2026, segunda rodada
   * O servidor manda uma linha por frase pronta, conforme pensa. A tela
   * comeca a sintetizar a primeira enquanto ele ainda escreve a segunda, em
   * vez de esperar a resposta inteira para so entao procurar a voz.
   */
  const responder = useCallback(
    async (textoDaPessoa) => {
      setPensando(true)
      setHumor(HUMORES.NEUTRO)

      try {
        const r = await fetch(ENDPOINT_CEREBRO, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ texto: textoDaPessoa, cracha: entrada.cracha }),
        })

        // SERVIDOR ANTIGO AINDA RESPONDE. Entre o `git pull` e o restart do
        // zeus-cerebro na VPS existe uma janela em que a tela e nova e o
        // servidor e velho. Melhor a tela aguentar os dois do que o Zeus
        // emudecer no meio da atualizacao.
        const formato = r.headers.get('Content-Type') || ''
        if (!formato.includes('ndjson') || !r.body) {
          const dados = await r.json().catch(() => null)
          if (dados?.precisaEntrar) entrada.esquecer()
          const resposta =
            dados?.resposta || 'Nao consegui falar com o meu servidor agora.'
          setHumor(detectarHumor(resposta))
          setPensando(false)
          await falar(resposta)
          return
        }

        let primeira = true
        const frases = (async function* () {
          for await (const linha of lerLinhas(r.body)) {
            let d = null
            try {
              d = JSON.parse(linha)
            } catch {
              continue
            }
            if (d?.t === 'fala' && d.texto) {
              // Humor definido pela PRIMEIRA frase, nao pela resposta
              // inteira: a expressao precisa estar no rosto no instante em
              // que a voz comeca, e nesse instante o resto ainda nem existe.
              if (primeira) {
                primeira = false
                setHumor(detectarHumor(d.texto))
                setPensando(false)
              }
              yield d.texto
            } else if (d?.t === 'fim' && d.precisaEntrar) {
              entrada.esquecer()
            }
          }
        })()

        await falarFluxo(frases)
        setPensando(false)
      } catch {
        setPensando(false)
        setHumor(HUMORES.FIRMEZA)
        await falar('Nao consegui falar com o meu servidor agora.')
      }
    },
    [falar, falarFluxo, entrada]
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

  // O Zeus chama o Paulo quando termina um trabalho, sem ele precisar
  // perguntar. So com o microfone fechado e ele calado — robo que fala por
  // cima do dono e robo que o dono desliga.
  useAviso({
    cracha: entrada.cracha,
    ocupado: estado !== ESTADOS.PARADO,
    falar,
  })

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

  // Enquanto o servidor nao diz se existe porta, nao pisca nada na tela: o
  // Zeus aparecendo e sumindo seria pior que meio segundo de preto.
  if (entrada.carregando) {
    return <main className="h-full w-full bg-movic-obsidiana" />
  }

  if (entrada.precisaEntrar) {
    return (
      <TelaEntrada
        aoEntrar={entrada.entrar}
        erro={entrada.erro}
        entrando={entrada.entrando}
      />
    )
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
