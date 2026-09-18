/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Azul neon eletrico da marca Movic.
        movic: {
          neon: '#38bdf8',
          eletrico: '#22d3ee',
          profundo: '#0891b2',
          obsidiana: '#05060a',
          grafite: '#0c0f16',
        },
      },
      keyframes: {
        // Fundo: linhas de dados atravessando a tela na horizontal.
        dados: {
          '0%': { transform: 'translateX(-100%)', opacity: '0' },
          '10%, 90%': { opacity: '0.7' },
          '100%': { transform: 'translateX(100%)', opacity: '0' },
        },
        // Fundo: particulas subindo devagar.
        flutuar: {
          '0%': { transform: 'translateY(0) scale(1)', opacity: '0' },
          '15%, 85%': { opacity: '0.55' },
          '100%': { transform: 'translateY(-120px) scale(0.6)', opacity: '0' },
        },
        // Varredura vertical sutil sobre o rosto: sensacao de sistema vivo.
        varredura: {
          '0%, 100%': { transform: 'translateY(-8%)', opacity: '0' },
          '50%': { transform: 'translateY(108%)', opacity: '0.5' },
        },
        // Pulsacao dos olhos. A duracao muda por humor, via style inline.
        pulsoOlho: {
          '0%, 100%': { opacity: '0.72' },
          '50%': { opacity: '1' },
        },
        // Halo de energia atras da cabeca.
        auraZeus: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.22' },
          '50%': { transform: 'scale(1.06)', opacity: '0.4' },
        },
        // Contorno de painel de dados: respira como tela sendo atualizada.
        brilhoPainel: {
          '0%, 100%': { opacity: '0.16', boxShadow: '0 0 12px 0 rgba(56,189,248,0.25)' },
          '50%': { opacity: '0.55', boxShadow: '0 0 26px 3px rgba(56,189,248,0.5)' },
        },
        // Ponto no mapa: acende e apaga, como leitura chegando.
        pontoMapa: {
          '0%, 100%': { opacity: '0.25', transform: 'scale(0.85)' },
          '50%': { opacity: '1', transform: 'scale(1.25)' },
        },
        // Onda que sai do ponto do mapa.
        radar: {
          '0%': { opacity: '0.55', transform: 'scale(0.5)' },
          '100%': { opacity: '0', transform: 'scale(2.6)' },
        },
        // Varredura horizontal dentro dos painéis laterais.
        varrePainel: {
          '0%': { transform: 'translateY(-10%)', opacity: '0' },
          '50%': { opacity: '0.4' },
          '100%': { transform: 'translateY(110%)', opacity: '0' },
        },
        surgir: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        dados: 'dados 9s linear infinite',
        flutuar: 'flutuar 11s ease-in-out infinite',
        varredura: 'varredura 6s ease-in-out infinite',
        pulsoOlho: 'pulsoOlho 3s ease-in-out infinite',
        auraZeus: 'auraZeus 4.5s ease-in-out infinite',
        brilhoPainel: 'brilhoPainel 4.5s ease-in-out infinite',
        pontoMapa: 'pontoMapa 3s ease-in-out infinite',
        radar: 'radar 3s ease-out infinite',
        varrePainel: 'varrePainel 6s ease-in-out infinite',
        surgir: 'surgir 0.35s ease-out both',
      },
    },
  },
  plugins: [],
}
