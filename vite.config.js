import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // /api/voz vai para o servico de voz local do Zeus
  // (zeus-voz/servico.py). Mesma origem, sem CORS.
  //
  // Declarado em `server` (npm run dev) e em `preview` (npm run preview,
  // que serve o build de producao): sem isto, o preview devolve 404 no
  // /api/voz e o Zeus fica mudo.
  server: {
    proxy: {
      '/api/voz': {
        target: 'http://127.0.0.1:8123',
        changeOrigin: true,
      },
      // /api/zeus vai para o cerebro (servidor/zeus.js), ao lado da voz.
      '/api/zeus': {
        target: 'http://127.0.0.1:8124',
        changeOrigin: true,
      },
    },
  },
  preview: {
    proxy: {
      '/api/voz': {
        target: 'http://127.0.0.1:8123',
        changeOrigin: true,
      },
      // /api/zeus vai para o cerebro (servidor/zeus.js), ao lado da voz.
      '/api/zeus': {
        target: 'http://127.0.0.1:8124',
        changeOrigin: true,
      },
    },
  },
})
