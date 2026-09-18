// servidor/porta.js  (repo: moviki-voice-interface)
//
// A PORTA DO ZEUS — quem entra, e como.
//
// O QUE ISTO CONSERTA
// Ate 18/09/2026 a unica protecao do Zeus era o ZEUS_TOKEN, que a tela
// mandava junto de cada pedido. So que a tela e uma pagina publica: o token
// viajava para o navegador e qualquer um lia no codigo dela. Era tranca de
// porta de banheiro — segura quem nao esta tentando entrar.
//
// Isso era um aborrecimento pequeno enquanto o Zeus so sabia o folheto da
// empresa. No instante em que ele ganha olhos — le o mapa mestre, sabe o que
// mudou em cada repositorio — a mesma porta destrancada passa a dar acesso a
// empresa inteira. Quem descobrisse o endereco perguntava, e o Zeus contava.
//
// COMO FICOU
// A senha mora SO no servidor e nunca e mandada para a tela. O Paulo digita
// uma vez; o servidor confere e devolve um cracha (um numero sorteado) que o
// navegador guarda. Os pedidos seguintes levam o cracha, nao a senha.
//
// Cracha roubado da para usar ate vencer; senha roubada da para sempre. Por
// isso a senha atravessa a rede uma vez so.
//
// O QUE ESTA PORTA NAO RESOLVE
// Sem HTTPS, a senha atravessa a rede em texto aberto e quem estiver no
// caminho le. A tranca so fica completa com o cadeado do navegador — ver
// servidor/README.md, secao HTTPS. Esta camada e necessaria, nao suficiente.

import crypto from 'node:crypto'

/** Quanto tempo o cracha vale. Padrao 30 dias: e o posto de comando do dono,
 *  nao um caixa eletronico — pedir senha toda hora vira senha colada na tela. */
const VALIDADE_PADRAO_MS = 30 * 24 * 60 * 60 * 1000

/** Quantos erros de senha antes de fechar a porta para aquele endereco. */
const ERROS_ATE_TRANCAR = 5

/** Quanto tempo a porta fica trancada depois disso. */
const CASTIGO_MS = 15 * 60 * 1000

/**
 * Compara dois textos sem entregar a resposta pelo tempo de resposta.
 *
 * Comparacao comum para na primeira letra diferente, e o tempo disso denuncia
 * quantas letras estavam certas — da para descobrir a senha uma letra por vez.
 * Comparando os resumos (sha256) o tamanho tambem nao vaza.
 */
export function iguaisNoEscuro(a, b) {
  const ra = crypto.createHash('sha256').update(String(a ?? '')).digest()
  const rb = crypto.createHash('sha256').update(String(b ?? '')).digest()
  return crypto.timingSafeEqual(ra, rb)
}

export function novoCracha() {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * A porta. Guarda os crachas validos e a conta de quem errou a senha.
 *
 * Fica na memoria de proposito: reiniciar o servico derruba todos os crachas,
 * e isso e desejavel — depois de mexer no Zeus, todo mundo entra de novo.
 */
export function criarPorta({ senha, validadeMs = VALIDADE_PADRAO_MS, agora = () => Date.now() } = {}) {
  const crachas = new Map() // cracha -> vence em
  const erros = new Map() // quem -> { contagem, trancadoAte }

  function limpar() {
    const t = agora()
    for (const [c, vence] of crachas) if (vence <= t) crachas.delete(c)
  }

  return {
    /** A porta esta ligada? Sem senha configurada, nao ha o que conferir. */
    exigeSenha() {
      return Boolean(senha)
    },

    /**
     * Tenta entrar. `quem` e o endereco de origem, so para contar os erros.
     *
     * Devolve { ok, cracha } ou { ok: false, motivo }.
     */
    entrar(tentativa, quem = 'desconhecido') {
      const t = agora()
      const registro = erros.get(quem) || { contagem: 0, trancadoAte: 0 }

      if (registro.trancadoAte > t) {
        return { ok: false, motivo: 'porta_trancada' }
      }

      if (!senha) {
        // Sem senha configurada a porta fica aberta. E ruim, e o servidor
        // grita sobre isso ao subir — mas nao e aqui que se decide.
        return { ok: true, cracha: this.emitir() }
      }

      if (!iguaisNoEscuro(tentativa, senha)) {
        registro.contagem += 1
        if (registro.contagem >= ERROS_ATE_TRANCAR) {
          registro.trancadoAte = t + CASTIGO_MS
          registro.contagem = 0
        }
        erros.set(quem, registro)
        return { ok: false, motivo: 'senha_errada' }
      }

      erros.delete(quem)
      return { ok: true, cracha: this.emitir() }
    },

    emitir() {
      limpar()
      const cracha = novoCracha()
      crachas.set(cracha, agora() + validadeMs)
      return cracha
    },

    /** O cracha apresentado serve? */
    vale(cracha) {
      if (!senha) return true
      if (!cracha) return false
      const vence = crachas.get(cracha)
      if (!vence) return false
      if (vence <= agora()) {
        crachas.delete(cracha)
        return false
      }
      return true
    },

    /** Derruba um cracha (sair) ou todos (depois de um susto). */
    revogar(cracha) {
      if (cracha) crachas.delete(cracha)
      else crachas.clear()
    },

    quantos() {
      limpar()
      return crachas.size
    },
  }
}
