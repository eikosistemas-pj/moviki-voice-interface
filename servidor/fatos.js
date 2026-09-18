// servidor/fatos.js  (repo: moviki-voice-interface)
//
// O QUE O ZEUS CONSEGUE PERCEBER SOZINHO.
//
// Aqui so se OLHA. Quem decide se algo vira chamado e o servidor/vigia.js,
// que e pura regra e nao toca em disco nem em rede — por isso da para provar
// as regras com teste, e este arquivo fica pequeno e chato de proposito.
//
// Nada aqui passa pelo cerebro: perceber nao e pensar, e estas sao contas que
// a maquina faz de graca e na hora.

import fs from 'node:fs/promises'
import { REPOS_PERMITIDOS } from './maos.js'

const DONO = 'eikosistemas-pj'

/**
 * Memoria REALMENTE disponivel, em MB.
 *
 * Nao e a "livre": o Linux usa quase toda a memoria sobrando como cache de
 * disco, e olhar a "livre" faria o Zeus gritar que a maquina esta acabando
 * quando ela esta apenas trabalhando. `MemAvailable` e o numero honesto.
 */
async function memoriaLivreMb() {
  try {
    const texto = await fs.readFile('/proc/meminfo', 'utf8')
    const linha = texto.split('\n').find((l) => l.startsWith('MemAvailable:'))
    const kb = Number(linha?.match(/(\d+)/)?.[1])
    return Number.isFinite(kb) ? Math.round(kb / 1024) : null
  } catch {
    return null
  }
}

/** A voz esta de pe? Ele consegue pensar sem ela, mas nao consegue falar. */
async function vozDePe(endereco = 'http://127.0.0.1:8123') {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 3000)
    await fetch(endereco, { signal: ctrl.signal }).catch(() => null)
    clearTimeout(t)
    // Qualquer resposta serve, inclusive erro: o que se quer saber e se tem
    // alguem atendendo naquela porta, nao se ele gostou do pedido.
    return true
  } catch {
    return false
  }
}

/** Pull Requests abertos, com quantas horas cada um esta esperando. */
async function prsParados() {
  const token = process.env.ZEUS_GITHUB_TOKEN
  if (!token) return []

  const parados = []
  for (const repo of REPOS_PERMITIDOS) {
    try {
      const r = await fetch(
        `https://api.github.com/repos/${DONO}/${repo}/pulls?state=open&per_page=20`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
          },
        }
      )
      if (!r.ok) continue
      const lista = await r.json()
      for (const pr of lista) {
        parados.push({
          repo,
          titulo: pr.title,
          horas: Math.round((Date.now() - new Date(pr.created_at).getTime()) / 3_600_000),
        })
      }
    } catch {
      // Um repositorio inalcancavel nao pode derrubar a ronda inteira.
    }
  }
  return parados
}

/** Junta tudo que ele consegue ver agora. */
export async function coletar({ usadasHoje, limiteDia } = {}) {
  const [memoria, voz, prs] = await Promise.all([
    memoriaLivreMb(),
    vozDePe(),
    prsParados(),
  ])
  return {
    memoriaLivreMb: memoria,
    vozDePe: voz,
    prsParados: prs,
    usadasHoje,
    limiteDia,
  }
}
