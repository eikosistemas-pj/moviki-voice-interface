import { useCallback, useEffect, useState } from 'react'
import { ENDPOINT_CEREBRO } from '../config/voz'

/**
 * A entrada do Zeus: senha uma vez, cracha daqui em diante.
 *
 * A senha NUNCA fica guardada no navegador — so o cracha, que vence sozinho.
 * Senha vazada da para sempre; cracha vazado da ate vencer.
 *
 * O cracha mora no `localStorage` para o Paulo nao digitar senha toda vez que
 * abrir a tela. Se o navegador recusar (janela anonima, cookies bloqueados),
 * tudo continua funcionando — ele so vai digitar a senha mais vezes. Por isso
 * cada acesso ao armazenamento esta embrulhado: em algumas situacoes ele
 * LANCA erro em vez de devolver vazio, e um erro nao tratado aqui deixaria a
 * tela preta.
 */
const CHAVE = 'zeus.cracha'

function lerCracha() {
  try {
    return window.localStorage.getItem(CHAVE) || ''
  } catch {
    return ''
  }
}

function guardarCracha(valor) {
  try {
    if (valor) window.localStorage.setItem(CHAVE, valor)
    else window.localStorage.removeItem(CHAVE)
  } catch {
    /* sem armazenamento: o cracha vale so enquanto a aba estiver aberta */
  }
}

export function useEntrada() {
  const [cracha, setCracha] = useState(lerCracha)
  const [exigeSenha, setExigeSenha] = useState(null) // null = ainda perguntando
  const [erro, setErro] = useState(null)
  const [entrando, setEntrando] = useState(false)

  // A tela pergunta ao servidor se existe porta. Ela nao decide isso sozinha:
  // quem manda e o servidor, e a resposta nao revela senha nenhuma.
  useEffect(() => {
    let vivo = true
    fetch(`${ENDPOINT_CEREBRO}/porta`)
      .then((r) => r.json())
      .then((d) => vivo && setExigeSenha(Boolean(d?.exigeSenha)))
      .catch(() => vivo && setExigeSenha(false))
    return () => {
      vivo = false
    }
  }, [])

  const entrar = useCallback(async (senha) => {
    setEntrando(true)
    setErro(null)
    try {
      const r = await fetch(`${ENDPOINT_CEREBRO}/entrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senha }),
      })
      const d = await r.json().catch(() => null)
      if (!r.ok || !d?.cracha) {
        setErro(d?.resposta || 'Nao consegui entrar.')
        return false
      }
      guardarCracha(d.cracha)
      setCracha(d.cracha)
      return true
    } catch {
      setErro('O Zeus nao respondeu. Ele esta de pe?')
      return false
    } finally {
      setEntrando(false)
    }
  }, [])

  /** O servidor recusou o cracha (venceu, ou o Zeus reiniciou). */
  const esquecer = useCallback(() => {
    guardarCracha('')
    setCracha('')
  }, [])

  const precisaEntrar = exigeSenha === true && !cracha

  return { cracha, precisaEntrar, carregando: exigeSenha === null, entrar, esquecer, erro, entrando }
}
