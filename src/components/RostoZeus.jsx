import { HUMORES } from '../config/voz'
import BocaOndas from './BocaOndas'

/**
 * Rosto do ZEUS.
 *
 * Robo imponente e minimalista, de frente, em azul neon eletrico (Movic).
 * Geometria em SVG: nada de imagem, tudo escala sem perder nitidez.
 *
 * As expressoes sao deliberadamente CONTIDAS. O Zeus e uma inteligencia de
 * comando: a felicidade dele e uma curvatura de 2px no canto da boca e um
 * pulso mais firme no olhar — nunca olho arregalado ou sorriso largo.
 */

/**
 * Parametros por humor.
 *
 * `pulso` e a duracao da animacao dos olhos: menor = mais intenso e firme;
 * maior = mais lento e espacado (impaciencia).
 */
const PORHUMOR = {
  [HUMORES.NEUTRO]: {
    pulso: '3s',
    olho: '#38bdf8',
    brilhoOlho: 0.85,
    sobrancelha: { y: 0, inclina: 0, opacidade: 0 },
    boca: 0,
  },
  [HUMORES.FELIZ]: {
    pulso: '2.4s',
    olho: '#38bdf8',
    brilhoOlho: 0.95,
    sobrancelha: { y: -1, inclina: 0, opacidade: 0 },
    // Curvatura minima: sobriedade e o ponto.
    boca: 2,
  },
  [HUMORES.ENTUSIASMO]: {
    // Pulsacao firme e mais intensa, sem euforia.
    pulso: '1.5s',
    olho: '#22d3ee',
    brilhoOlho: 1,
    sobrancelha: { y: -2, inclina: 0, opacidade: 0 },
    boca: 3,
  },
  [HUMORES.IMPACIENCIA]: {
    // Pulsacao mais lenta e espacada.
    pulso: '5.2s',
    olho: '#38bdf8',
    brilhoOlho: 0.7,
    // Sobrancelhas retas, levemente inclinadas.
    sobrancelha: { y: 2, inclina: 7, opacidade: 0.9 },
    boca: 0,
  },
  [HUMORES.FIRMEZA]: {
    pulso: '2.1s',
    // Ciano/azul profundo e penetrante.
    olho: '#0891b2',
    brilhoOlho: 1,
    // Tensionadas para baixo.
    sobrancelha: { y: 7, inclina: 15, opacidade: 1 },
    boca: -2,
  },
}

export default function RostoZeus({ estado, humor, nivelRef }) {
  const cfg = PORHUMOR[humor] || PORHUMOR[HUMORES.NEUTRO]

  const { sobrancelha, boca } = cfg

  return (
    <div className="relative flex items-center justify-center">
      {/* Aura de energia atras da cabeca. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute h-[22rem] w-[22rem] rounded-full bg-movic-neon/20 blur-[90px] animate-auraZeus"
      />

      <svg
        viewBox="0 0 240 260"
        className="relative h-[19rem] w-[19rem] sm:h-[22rem] sm:w-[22rem]"
        role="img"
        aria-label={`Rosto do Zeus, expressao ${humor}`}
      >
        <defs>
          {/* Metal escuro do casco. */}
          <linearGradient id="casco" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1b2331" />
            <stop offset="55%" stopColor="#111823" />
            <stop offset="100%" stopColor="#0a0e16" />
          </linearGradient>

          {/* Placa interna da face, levemente mais clara no topo. */}
          <linearGradient id="placa" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#151d2a" />
            <stop offset="100%" stopColor="#0b1018" />
          </linearGradient>

          <linearGradient id="neon" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#0891b2" />
            <stop offset="50%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#0891b2" />
          </linearGradient>

          {/* Brilho neon: usado nos olhos e na boca. */}
          <filter id="brilho" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="3.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="brilhoForte" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="5.5" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Recorte da face, para a varredura nao escapar do casco. */}
          <clipPath id="recorteFace">
            <rect x="52" y="52" width="136" height="132" rx="26" />
          </clipPath>
        </defs>

        {/* ---------------- Antena / crista superior ---------------- */}
        <line
          x1="120" y1="14" x2="120" y2="34"
          stroke="url(#neon)" strokeWidth="2.5" strokeLinecap="round"
          opacity="0.9"
        />
        <circle
          cx="120" cy="11" r="4.5"
          fill="#38bdf8" filter="url(#brilhoForte)"
          className="animate-pulsoOlho"
          style={{ animationDuration: cfg.pulso }}
        />

        {/* ---------------- Cabeca ---------------- */}
        {/* Casco externo: ombros largos no topo dao imponencia. */}
        <rect
          x="36" y="34" width="168" height="168" rx="34"
          fill="url(#casco)" stroke="#243247" strokeWidth="2"
        />

        {/* Fiação lateral esquerda: circuitos visiveis. */}
        <g stroke="url(#neon)" strokeWidth="1.6" opacity="0.75" fill="none">
          <path d="M36 92 H18 V120" strokeLinecap="round" />
          <path d="M36 140 H24" strokeLinecap="round" />
          <path d="M204 92 H222 V120" strokeLinecap="round" />
          <path d="M204 140 H216" strokeLinecap="round" />
        </g>
        <circle cx="18" cy="126" r="3" fill="#38bdf8" filter="url(#brilho)" opacity="0.9" />
        <circle cx="222" cy="126" r="3" fill="#38bdf8" filter="url(#brilho)" opacity="0.9" />

        {/* Orelheiras / modulos laterais. */}
        <rect x="26" y="96" width="12" height="52" rx="6" fill="#131a26" stroke="#24344a" strokeWidth="1.5" />
        <rect x="202" y="96" width="12" height="52" rx="6" fill="#131a26" stroke="#24344a" strokeWidth="1.5" />

        {/* Placa interna da face. */}
        <rect
          x="52" y="52" width="136" height="132" rx="26"
          fill="url(#placa)" stroke="#2b3c54" strokeWidth="1.5"
        />

        {/* Varredura vertical: sistema vivo, contida pelo recorte. */}
        <g clipPath="url(#recorteFace)">
          <rect
            x="52" y="52" width="136" height="16"
            fill="#38bdf8" opacity="0.12"
            className="animate-varredura"
          />
        </g>

        {/* Trilhas de circuito na testa. */}
        <g stroke="#38bdf8" strokeWidth="1.2" opacity="0.4" fill="none">
          <path d="M70 70 H98 V80" strokeLinecap="round" />
          <path d="M170 70 H142 V80" strokeLinecap="round" />
          <path d="M120 60 V70" strokeLinecap="round" />
        </g>

        {/* ---------------- Sobrancelhas ---------------- */}
        {/*
          Retas e geometricas. Invisiveis no neutro/feliz (opacidade 0):
          sobrancelha aparente por padrao daria cara de desenho animado.
        */}
        <g
          stroke="#38bdf8"
          strokeWidth="4"
          strokeLinecap="round"
          filter="url(#brilho)"
          style={{
            opacity: sobrancelha.opacidade,
            transition: 'opacity 420ms ease',
          }}
        >
          <line
            x1="74" y1="98" x2="106" y2="98"
            style={{
              transform: `translateY(${sobrancelha.y}px) rotate(${sobrancelha.inclina}deg)`,
              transformOrigin: '90px 98px',
              transition: 'transform 420ms ease',
            }}
          />
          <line
            x1="134" y1="98" x2="166" y2="98"
            style={{
              transform: `translateY(${sobrancelha.y}px) rotate(${-sobrancelha.inclina}deg)`,
              transformOrigin: '150px 98px',
              transition: 'transform 420ms ease',
            }}
          />
        </g>

        {/* ---------------- Olhos ---------------- */}
        {/*
          Barras horizontais arredondadas, nao circulos: olhar de visor,
          firme e fardado. Altura fixa em todos os humores — o que muda e
          a cor e o ritmo do pulso, nunca a abertura (olho arregalado
          quebraria a sobriedade).
        */}
        <g
          filter="url(#brilhoForte)"
          className="animate-pulsoOlho"
          style={{ animationDuration: cfg.pulso }}
        >
          <rect
            x="72" y="112" width="36" height="13" rx="6.5"
            fill={cfg.olho}
            style={{ opacity: cfg.brilhoOlho, transition: 'fill 500ms ease' }}
          />
          <rect
            x="132" y="112" width="36" height="13" rx="6.5"
            fill={cfg.olho}
            style={{ opacity: cfg.brilhoOlho, transition: 'fill 500ms ease' }}
          />
        </g>

        {/* Reflexo fino sobre os olhos: profundidade de vidro. */}
        <rect x="76" y="114" width="16" height="2.5" rx="1.25" fill="#e0f7ff" opacity="0.5" />
        <rect x="136" y="114" width="16" height="2.5" rx="1.25" fill="#e0f7ff" opacity="0.5" />

        {/* ---------------- Boca: waveform audio-reativa ---------------- */}
        {/* Base da boca: linha tenue que sustenta a onda. */}
        <line
          x1="78" y1="158" x2="162" y2="158"
          stroke="#1e3a52" strokeWidth="2" strokeLinecap="round"
        />

        {/*
          Mesmo componente usado sobre a imagem `zeus.png`: a logica das
          ondas vive num lugar so. `foreignObject` permite embutir o SVG
          do componente dentro deste SVG sem duplicar o codigo.
        */}
        <foreignObject x="76" y="142" width="88" height="32">
          <BocaOndas estado={estado} nivelRef={nivelRef} cor={cfg.olho} />
        </foreignObject>

        {/*
          Curvatura sutil do canto da boca: o unico "sorriso" que o Zeus
          faz. `boca` vale 2 ou 3px no maximo, e negativo na firmeza.
        */}
        <path
          d={`M84 ${170 - boca} Q120 ${170 + boca * 1.6} 156 ${170 - boca}`}
          stroke="#38bdf8"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          style={{
            opacity: boca === 0 ? 0.22 : 0.75,
            transition: 'all 420ms ease',
          }}
        />

        {/* ---------------- Queixo / base ---------------- */}
        <rect x="92" y="196" width="56" height="10" rx="5" fill="#131a26" stroke="#24344a" strokeWidth="1.5" />
        <line
          x1="104" y1="201" x2="136" y2="201"
          stroke="url(#neon)" strokeWidth="1.6" strokeLinecap="round" opacity="0.8"
        />
      </svg>
    </div>
  )
}
