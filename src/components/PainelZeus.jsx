import { useState } from 'react'
import BocaOndas from './BocaOndas'
import RostoZeus from './RostoZeus'
import CamadasPainel from './CamadasPainel'
import { BOCA, IMAGEM_ZEUS, OLHOS, PAINEIS, PONTOS_MAPA } from '../config/painel'
import { HUMORES } from '../config/voz'

/**
 * Painel do ZEUS: imagem definitiva + camadas de animacao por cima.
 *
 * O quadro e um 16:9 que se encaixa na tela (`aspect-video` limitado por
 * largura E altura). A imagem preenche esse quadro exatamente, e as
 * camadas sao posicionadas em % DO QUADRO — por isso olhos e boca ficam
 * alinhados em qualquer resolucao.
 *
 * Nao uso `object-cover` em tela cheia de proposito: cover recorta a
 * imagem de forma diferente em cada proporcao de tela, e o recorte
 * desalinharia as camadas justamente nos olhos.
 *
 * Enquanto `zeus.png` nao existir, cai para o rosto SVG: o painel
 * continua operando em vez de mostrar icone de imagem quebrada.
 */

/** Cor e ritmo do olhar por humor. Sobriedade e a regra. */
const OLHAR = {
  [HUMORES.NEUTRO]: { cor: '#38bdf8', pulso: '3s', brilho: 0.8 },
  [HUMORES.FELIZ]: { cor: '#38bdf8', pulso: '2.4s', brilho: 0.9 },
  // Entusiasmo = pulsacao firme e mais intensa, nunca euforia.
  [HUMORES.ENTUSIASMO]: { cor: '#22d3ee', pulso: '1.5s', brilho: 1 },
  // Impaciencia = pulso lento e espacado.
  [HUMORES.IMPACIENCIA]: { cor: '#38bdf8', pulso: '5.2s', brilho: 0.62 },
  // Firmeza = ciano profundo e penetrante.
  [HUMORES.FIRMEZA]: { cor: '#0891b2', pulso: '2.1s', brilho: 1 },
}

/** Curvatura do canto da boca, em px. Maximo 3: o Zeus nao ri. */
const CURVA = {
  [HUMORES.NEUTRO]: 0,
  [HUMORES.FELIZ]: 2,
  [HUMORES.ENTUSIASMO]: 3,
  [HUMORES.IMPACIENCIA]: 0,
  [HUMORES.FIRMEZA]: -2,
}

/**
 * Agitacao das ondas da boca por humor.
 *
 * Multiplica a amplitude real do audio — nao cria movimento do nada. Fora
 * da faixa 0.8-1.2 a fala deixaria de parecer sincronizada com o som.
 */
const AGITACAO = {
  [HUMORES.NEUTRO]: 1,
  [HUMORES.FELIZ]: 1.05,
  [HUMORES.ENTUSIASMO]: 1.2,
  [HUMORES.IMPACIENCIA]: 0.82,
  [HUMORES.FIRMEZA]: 1.12,
}

function Olho({ posicao, olhar, tamanho }) {
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${posicao.x}%`, top: `${posicao.y}%` }}
    >
      {/* Halo externo: presenca do olhar, sem endurecer a borda. */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full blur-md"
        style={{
          width: `${tamanho * 3.2}vw`,
          height: `${tamanho * 3.2}vw`,
          backgroundColor: olhar.cor,
          opacity: olhar.brilho * 0.42,
          animationDuration: olhar.pulso,
        }}
      />
      {/* Nucleo: o brilho do olho propriamente dito. */}
      <div
        className="relative animate-pulse rounded-full"
        style={{
          width: `${tamanho}vw`,
          height: `${tamanho}vw`,
          backgroundColor: olhar.cor,
          opacity: olhar.brilho,
          boxShadow: `0 0 ${tamanho * 10}px ${olhar.cor}`,
          animationDuration: olhar.pulso,
          transition: 'background-color 500ms ease, opacity 500ms ease',
        }}
      />
    </div>
  )
}

export default function PainelZeus({ estado, humor, nivelRef, calibrar }) {
  const [imagemFalhou, setImagemFalhou] = useState(false)

  const olhar = OLHAR[humor] || OLHAR[HUMORES.NEUTRO]
  const curva = CURVA[humor] ?? 0
  const agitacao = AGITACAO[humor] ?? 1

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      {/*
        Quadro 16:9 que respeita as duas dimensoes da tela: em monitor
        largo sobra faixa lateral, em tela alta sobra em cima e embaixo —
        e a imagem nunca e recortada nem distorcida.
      */}
      <div className="relative aspect-video max-h-full w-full max-w-[177.78vh]">
        {!imagemFalhou ? (
          <img
            src={IMAGEM_ZEUS}
            alt="Zeus, assistente de voz do ecossistema Moviki"
            onError={() => setImagemFalhou(true)}
            className="absolute inset-0 h-full w-full select-none object-contain"
            draggable="false"
          />
        ) : (
          /* Reserva: rosto geometrico enquanto o zeus.png nao subir. */
          <div className="absolute inset-0 flex items-center justify-center">
            <RostoZeus estado={estado} humor={humor} nivelRef={nivelRef} />
          </div>
        )}

        {/* Camadas de animacao: so sobre a imagem real. */}
        {!imagemFalhou && (
          <>
            {/* Telas de dados da MOVIKI brilhando ao fundo. */}
            <CamadasPainel cor={olhar.cor} />

            <Olho posicao={OLHOS.esquerdo} olhar={olhar} tamanho={OLHOS.tamanho} />
            <Olho posicao={OLHOS.direito} olhar={olhar} tamanho={OLHOS.tamanho} />

            {/* Boca: grafico de ondas no ritmo do audio. */}
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${BOCA.x}%`,
                top: `${BOCA.y}%`,
                width: `${BOCA.largura}%`,
                height: `${BOCA.altura}%`,
              }}
            >
              <BocaOndas
                estado={estado}
                nivelRef={nivelRef}
                cor={olhar.cor}
                agitacao={agitacao}
              />
            </div>

            {/* Curvatura sutil do canto da boca: o unico "sorriso". */}
            <svg
              className="absolute -translate-x-1/2 -translate-y-1/2 overflow-visible"
              style={{
                left: `${BOCA.x}%`,
                top: `${BOCA.y + BOCA.altura * 0.95}%`,
                width: `${BOCA.largura}%`,
                height: `${BOCA.altura * 0.6}%`,
              }}
              viewBox="0 0 100 12"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                d={`M12 ${6 - curva} Q50 ${6 + curva * 2.2} 88 ${6 - curva}`}
                stroke={olhar.cor}
                strokeWidth="1.6"
                strokeLinecap="round"
                fill="none"
                style={{
                  opacity: curva === 0 ? 0 : 0.7,
                  transition: 'all 420ms ease',
                }}
              />
            </svg>
          </>
        )}

        {/*
          Modo calibracao (`?calibrar=1`): miras e grade de 10% para
          ajustar as coordenadas de src/config/painel.js a imagem real.
        */}
        {calibrar && (
          <div className="pointer-events-none absolute inset-0">
            <div
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  'linear-gradient(#f0f 1px, transparent 1px), linear-gradient(90deg, #f0f 1px, transparent 1px)',
                backgroundSize: '10% 10%',
              }}
            />
            {[
              { p: OLHOS.esquerdo, r: 'olho esq' },
              { p: OLHOS.direito, r: 'olho dir' },
              { p: { x: BOCA.x, y: BOCA.y }, r: 'boca' },
            ].map((m) => (
              <div
                key={m.r}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${m.p.x}%`, top: `${m.p.y}%` }}
              >
                <div className="h-6 w-6 rounded-full border-2 border-fuchsia-500" />
                <span className="absolute left-7 top-0 whitespace-nowrap font-mono text-[10px] text-fuchsia-400">
                  {m.r} {m.p.x}% / {m.p.y}%
                </span>
              </div>
            ))}

            {/* Retangulos dos painéis laterais, para conferir encaixe. */}
            {PAINEIS.map((p, i) => (
              <div
                key={`cal-painel-${i}`}
                className="absolute border-2 border-dashed border-lime-400"
                style={{
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  width: `${p.largura}%`,
                  height: `${p.altura}%`,
                }}
              >
                <span className="absolute left-0 top-0 font-mono text-[9px] text-lime-300">
                  painel {i} · {p.x},{p.y} {p.largura}x{p.altura}
                </span>
              </div>
            ))}

            {/* Pontos do mapa. */}
            {PONTOS_MAPA.map((pt, i) => (
              <div
                key={`cal-ponto-${i}`}
                className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-400"
                style={{ left: `${pt.x}%`, top: `${pt.y}%` }}
                title={`ponto ${i}: ${pt.x},${pt.y}`}
              />
            ))}

            <p className="absolute bottom-2 left-2 max-w-[60%] font-mono text-[10px] leading-relaxed text-fuchsia-400">
              calibracao · magenta = olhos/boca · verde = painéis · ambar = pontos do mapa
              <br />
              ajuste src/config/painel.js ate cada marca cair no alvo da imagem
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
