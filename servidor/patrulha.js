// servidor/patrulha.js  (repo: moviki-voice-interface)
//
// O ZEUS OLHANDO O CODIGO SEM NINGUEM PEDIR.
//
// O PEDIDO DO PAULO — 18/09/2026
// "Ele nao consegue interagir comigo se eu nao interagir com ele primeiro. Eu
// quero que ele ache uma coisa errada e me fale."
//
// A DIFERENCA PARA O QUE JA EXISTIA
// O `vigia.js` ja chamava o Paulo sozinho — mas so sobre a MAQUINA: memoria
// apertando, voz caida, Pull Request parado. Contas que o servidor faz de
// graca, sem ler nada.
//
// A patrulha e outra coisa: ela LE O CODIGO procurando problema. E o primeiro
// pedaco do Zeus que gasta dinheiro sem ninguem ter pedido — e por isso e o
// que precisa de mais freio.
//
// ---------------------------------------------------------------------------
// OS QUATRO FREIOS, E POR QUE CADA UM EXISTE
// ---------------------------------------------------------------------------
//
// 1. SO OLHA O QUE MUDOU. Repositorio parado nao ganha patrulha: reler o mesmo
//    codigo intacto de hora em hora e queimar dinheiro para chegar sempre na
//    mesma conclusao. Ele guarda qual commit ja olhou de cada repositorio.
//
// 2. UM DE CADA VEZ, EM RODIZIO. Quatro repositorios na mesma rodada seriam
//    quatro chamadas caras de uma vez numa maquina de um processador.
//
// 3. TETO PROPRIO DE PATRULHAS POR DIA, separado do teto de falas. Sem isso um
//    repositorio movimentado viraria conta de luz.
//
// 4. O PADRAO E O SILENCIO. A patrulha so vira chamado se o proprio Zeus
//    marcar que aquilo vale acordar o Paulo — e a instrucao dele (ver
//    `instrucaoDePatrulha` em analise.js) diz com todas as letras que estilo de
//    codigo e "daria para melhorar" NAO valem.
//
// E depois disso tudo ela ainda passa pelas regras do vigia: cada assunto fala
// uma vez, e ha descanso entre avisos. Robo que fala demais e desligado na
// primeira semana — e ai nao avisa nem o que importava.

import { analisar } from './analise.js'
import { REPOS_PERMITIDOS } from './maos.js'

/** De quanto em quanto tempo ele sai para olhar. */
export const INTERVALO_MS = Number(process.env.ZEUS_PATRULHA_INTERVALO || 45 * 60 * 1000)

/** Teto de patrulhas por dia. Separado do teto de falas, de proposito. */
export const TETO_DIA = Number(process.env.ZEUS_PATRULHA_TETO || 12)

/**
 * Escolhe o proximo repositorio a olhar.
 *
 * Prefere o que MUDOU desde a ultima olhada. Se nenhum mudou, devolve null e a
 * rodada nao acontece — silencio e de graca, e ler codigo intacto nao e.
 *
 *   commits: { repo: 'sha' }   o estado de agora, lido do espelho
 *   jaOlhados: { repo: 'sha' } o que ele ja viu
 */
export function escolherAlvo(commits, jaOlhados = {}) {
  const mudaram = REPOS_PERMITIDOS.filter((r) => {
    const agora = commits?.[r]
    if (!agora) return false
    return jaOlhados[r] !== agora
  })
  if (!mudaram.length) return null

  // Rodizio: o que esta ha mais tempo sem ser olhado vem primeiro. Sem isso,
  // um repositorio muito movimentado tomaria todas as rodadas e os outros
  // nunca seriam vistos.
  const nuncaOlhado = mudaram.find((r) => !jaOlhados[r])
  return nuncaOlhado || mudaram[0]
}

/** Quantas patrulhas ja rodaram hoje. */
export function patrulhasHoje(estado, hoje) {
  const p = estado.patrulha || {}
  return p.dia === hoje ? Number(p.quantas) || 0 : 0
}

export function contarPatrulha(estado, hoje) {
  const quantas = patrulhasHoje(estado, hoje) + 1
  estado.patrulha = { ...(estado.patrulha || {}), dia: hoje, quantas }
  return estado
}

export function marcarOlhado(estado, repo, sha) {
  estado.patrulha = {
    ...(estado.patrulha || {}),
    vistos: { ...(estado.patrulha?.vistos || {}), [repo]: sha },
  }
  return estado
}

export function jaOlhados(estado) {
  return estado.patrulha?.vistos || {}
}

/**
 * Uma rodada de patrulha.
 *
 * Devolve `{ chave, fala }` pronto para virar chamado, ou null — que e o caso
 * normal e desejado. Nunca lanca.
 */
export async function patrulhar({ repo }) {
  try {
    const r = await analisar({
      repo,
      pergunta: `Olhe o ${repo} procurando problema, por conta propria.`,
      patrulha: true,
    })

    if (!r.ok) {
      console.warn(`[zeus] patrulha em ${repo} nao fechou: ${(r.erros || []).join('; ')}`)
      return null
    }

    if (!r.valeAcordar) {
      console.log(`[zeus] patrulha em ${repo}: nada que valha interromper o Paulo`)
      return null
    }

    const fala = String(r.resposta || '').trim()
    if (!fala) return null

    // A chave carrega o repositorio: assim "achei problema no painel" e "achei
    // problema no site" sao assuntos DIFERENTES e nao se calam um ao outro.
    // Mas duas patrulhas no mesmo repositorio, sim — senao ele repetiria a
    // mesma queixa a cada rodada.
    return { chave: `patrulha_${repo}`, fala }
  } catch (e) {
    console.error(`[zeus] patrulha em ${repo} quebrou: ${e?.message || e}`)
    return null
  }
}
