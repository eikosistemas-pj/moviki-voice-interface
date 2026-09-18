import { PAINEIS, PONTOS_MAPA } from '../config/painel'

/**
 * Iluminacao dinamica das telas de dados da MOVIKI ao fundo.
 *
 * Sobrepõe contornos que respiram nos painéis laterais e pontos que
 * acendem sobre o mapa, para o fundo parecer um sistema em operacao, nao
 * uma captura de tela parada.
 *
 * Tudo por keyframes de CSS, sem JavaScript por frame: o custo fica na
 * GPU e nao disputa os 60fps do requestAnimationFrame que move a boca
 * audio-reativa — que e a animacao que realmente precisa de precisao.
 *
 * As posicoes vivem em `config/painel.js` e precisam ser calibradas
 * contra o zeus.png real (ver `?calibrar=1`).
 */
export default function CamadasPainel({ cor = '#38bdf8' }) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {/* Painéis laterais: contorno pulsando + varredura interna. */}
      {PAINEIS.map((p, i) => (
        <div
          key={`painel-${i}`}
          className="absolute overflow-hidden rounded-lg border animate-brilhoPainel"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: `${p.largura}%`,
            height: `${p.altura}%`,
            borderColor: cor,
            animationDelay: p.atraso,
            animationDuration: p.duracao,
          }}
        >
          {/* Linha de varredura: dados sendo relidos de cima a baixo. */}
          <div
            className="absolute inset-x-0 h-1/4 animate-varrePainel"
            style={{
              background: `linear-gradient(180deg, transparent, ${cor}40, transparent)`,
              animationDelay: p.atraso,
            }}
          />
        </div>
      ))}

      {/* Pontos do mapa: leitura chegando em tempo real. */}
      {PONTOS_MAPA.map((pt, i) => (
        <div
          key={`ponto-${i}`}
          className="absolute -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${pt.x}%`, top: `${pt.y}%` }}
        >
          {/* Onda de radar saindo do ponto. */}
          <div
            className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 animate-radar rounded-full border"
            style={{
              borderColor: cor,
              animationDelay: pt.atraso,
              animationDuration: pt.duracao,
            }}
          />
          {/* Nucleo do ponto. */}
          <div
            className="relative h-1.5 w-1.5 animate-pontoMapa rounded-full"
            style={{
              backgroundColor: cor,
              boxShadow: `0 0 10px ${cor}`,
              animationDelay: pt.atraso,
              animationDuration: pt.duracao,
            }}
          />
        </div>
      ))}
    </div>
  )
}
