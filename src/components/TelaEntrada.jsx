import { useState } from 'react'

/**
 * A tela que pede a senha do Zeus.
 *
 * Sobria de proposito: o Zeus so aparece depois. Quem chegar aqui sem senha
 * nao descobre nada sobre o Moviki nem sobre quem e o dono — nem o nome da
 * empresa esta escrito.
 *
 * A FRASE E DO PAULO, PALAVRA POR PALAVRA (18/09/2026).
 * Nao mexer no texto sem ele pedir: e a voz do Zeus se apresentando, e o tom
 * foi escolhido por ele. Repare que ela tambem nao entrega nada — fala de
 * "conhecimento" e "mestre", nao de Moviki, nem de lojista, nem de dono.
 */
export const SAUDACAO =
  'Só darei acesso a todo meu conhecimento, se você provar que é o meu mestre... ' +
  'Digite a senha, caso contrário estará destinado ao fracasso, comece...'

export default function TelaEntrada({ aoEntrar, erro, entrando }) {
  const [senha, setSenha] = useState('')

  const enviar = (e) => {
    e.preventDefault()
    if (senha.trim()) aoEntrar(senha)
  }

  return (
    <main className="flex h-full w-full items-center justify-center bg-movic-obsidiana px-6">
      <form onSubmit={enviar} className="w-full max-w-sm text-center">
        <div className="mx-auto mb-8 h-px w-40 bg-gradient-to-r from-transparent via-movic-neon/45 to-transparent" />

        {/*
          A saudacao vem ANTES do campo, e com folga em volta: ela e a primeira
          coisa que o Zeus diz, e tem que ser lida antes de a mao ir ao teclado.
        */}
        <p className="mb-8 text-[13px] leading-relaxed tracking-wide text-movic-neon/70">
          {SAUDACAO}
        </p>

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
