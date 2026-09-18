import { useState } from 'react'

/**
 * A tela que pede a senha do Zeus.
 *
 * Sobria de proposito: o Zeus so aparece depois. Quem chegar aqui sem senha
 * nao descobre nada sobre o Moviki nem sobre quem e o dono — nem o nome da
 * empresa esta escrito.
 */
export default function TelaEntrada({ aoEntrar, erro, entrando }) {
  const [senha, setSenha] = useState('')

  const enviar = (e) => {
    e.preventDefault()
    if (senha.trim()) aoEntrar(senha)
  }

  return (
    <main className="flex h-full w-full items-center justify-center bg-movic-obsidiana px-6">
      <form onSubmit={enviar} className="w-full max-w-xs text-center">
        <div className="mx-auto mb-8 h-px w-40 bg-gradient-to-r from-transparent via-movic-neon/45 to-transparent" />

        <input
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          // autoFocus aqui e cortesia, nao armadilha: e a unica coisa na tela.
          autoFocus
          autoComplete="current-password"
          aria-label="Senha"
          className="w-full rounded-2xl border border-white/10 bg-[#0d121b] px-4 py-3 text-center tracking-[0.3em] text-movic-neon/90 outline-none focus:border-movic-neon/40"
        />

        <button
          type="submit"
          disabled={entrando || !senha.trim()}
          className="mt-4 w-full rounded-2xl border border-movic-neon/25 bg-movic-neon/[0.07] px-4 py-3 text-sm tracking-wide text-movic-neon/80 disabled:opacity-40"
        >
          {entrando ? 'conferindo' : 'entrar'}
        </button>

        {erro && (
          <p className="mt-4 text-[11px] tracking-wide text-movic-neon/50">{erro}</p>
        )}

        <div className="mx-auto mt-8 h-px w-40 bg-gradient-to-r from-transparent via-movic-neon/20 to-transparent" />
      </form>
    </main>
  )
}
