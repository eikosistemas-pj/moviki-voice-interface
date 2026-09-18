// servidor/olhos.js  (repo: moviki-voice-interface)
//
// OS OLHOS DO ZEUS.
//
// O QUE ISTO RESOLVE
// Ate agora o Zeus so sabia o resumo escrito no prompt dele. Perguntado sobre
// o que mudou no painel essa semana, nao tinha como saber, e a instrucao
// mandava dizer que nao sabia. Assistente que so conhece o folheto da empresa
// nao substitui ninguem — que foi exatamente a reclamacao do Paulo.
//
// Agora a VPS guarda um ESPELHO dos repositorios do Moviki e dali saem:
//
//   O MAPA     — o CLAUDE.md, a memoria oficial do projeto
//   O RETRATO  — em que ramo cada repo esta e o que entrou ultimamente
//
// ESPELHO E SO LEITURA, E ISSO E DE PROPOSITO
// O Zeus nunca escreve aqui, nunca faz commit, nunca empurra nada. Se um dia
// ele ganhar maos, as maos serao outra coisa, em outra pasta, com outra
// trava. Misturar "onde ele le" com "onde ele mexe" e deixar a chave do cofre
// em cima do cofre.
//
// A PORTA PRECISA ESTAR TRANCADA ANTES DISTO
// Enquanto o Zeus so sabia o folheto, uma porta fraca era aborrecimento
// pequeno. Sabendo de tudo, a mesma porta passa a dar a empresa inteira a
// quem descobrir o endereco. Por isso este modulo so entrou junto com
// servidor/porta.js, e o servidor recusa subir com os olhos abertos e a porta
// destrancada. Ver zeus.js.
//
// SO OS REPOSITORIOS PUBLICOS
// `moviki-vault` fica de fora. E o cofre do Obsidian do Paulo, privado, e o
// mapa mestre e explicito: nunca publicar nada que venha de la. O Zeus fala
// em voz alta — o que ele sabe, ele diz.

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs'
import path from 'node:path'

const executar = promisify(execFile)

/** Onde ficam os espelhos, na VPS. */
const RAIZ = process.env.ZEUS_ESPELHO || '/root/eikosistemas'

const DONO = 'eikosistemas-pj'

/** Os repositorios de codigo do Moviki. Sem o vault, que e privado. */
export const REPOS = [
  'moviki',
  'moviki-app',
  'moviki-robo',
  'moviki-ai',
  'moviki-assistente-social',
  'moviki-voice-interface',
]

/** De quanto em quanto tempo vale a pena olhar de novo. */
const VALIDADE_MS = Number(process.env.ZEUS_OLHOS_VALIDADE || 15 * 60 * 1000)

let cache = { em: 0, mapa: null, retrato: null }

async function git(pasta, args, tempo = 60_000) {
  try {
    const { stdout } = await executar('git', ['-C', pasta, ...args], {
      timeout: tempo,
      maxBuffer: 2 * 1024 * 1024,
    })
    return stdout.trim()
  } catch (e) {
    return `(nao consegui ler: ${String(e?.message || 'erro').slice(0, 80)})`
  }
}

/**
 * Traz o espelho de um repositorio para o estado de agora.
 *
 * Clone raso de proposito: o Zeus precisa saber o que o codigo E hoje, nao a
 * arqueologia de dois anos. Historia funda custa disco e tempo numa maquina
 * de 2 GB que ja passou aperto.
 */
async function espelhar(repo) {
  const pasta = path.join(RAIZ, repo)
  if (!fs.existsSync(path.join(pasta, '.git'))) {
    try {
      await executar(
        'git',
        ['clone', '--depth', '30', `https://github.com/${DONO}/${repo}`, pasta],
        { timeout: 300_000 }
      )
      return true
    } catch {
      return false
    }
  }
  // fetch + reset, nao pull: o espelho nao tem trabalho local a preservar, e
  // pull daria conflito se alguem tivesse mexido ali na mao.
  const ramo = (await git(pasta, ['symbolic-ref', '--short', 'HEAD'])) || 'main'
  await git(pasta, ['fetch', '--depth', '30', 'origin', ramo], 180_000)
  await git(pasta, ['reset', '--hard', 'FETCH_HEAD'])
  return true
}

async function lerRepo(repo) {
  const pasta = path.join(RAIZ, repo)
  if (!fs.existsSync(pasta)) return { repo, ausente: true }
  return {
    repo,
    ramo: await git(pasta, ['symbolic-ref', '--short', 'HEAD']),
    commits: (await git(pasta, ['log', '-6', '--date=short', '--pretty=%ad  %s']))
      .split('\n')
      .filter(Boolean),
  }
}

/**
 * Monta o texto do retrato.
 *
 * Separado da parte que fala com o disco para poder ser testado sem git, sem
 * rede e sem VPS — mesma ideia do tetoDia.js do moviki-ai.
 */
export function formatarRetrato(repos, agora = new Date()) {
  const quando = agora.toISOString().slice(0, 16).replace('T', ' ')
  const linhas = [
    `ESTADO REAL DOS REPOSITORIOS, lido em ${quando} UTC.`,
    'Isto foi lido do codigo agora. Pode falar como fato.',
    '',
  ]

  for (const r of repos) {
    if (r.ausente) {
      linhas.push(`${r.repo}: sem espelho nesta maquina ainda.`)
      continue
    }
    linhas.push(`${r.repo} — ramo ${r.ramo}:`)
    for (const c of r.commits) linhas.push(`   ${c}`)
    linhas.push('')
  }

  linhas.push(
    'O QUE ESTE RETRATO NAO COBRE: numeros do negocio — quantos lojistas,',
    'faturamento, assinaturas, pedidos. Isso mora no Firestore e o Zeus ainda',
    'nao enxerga. Perguntado sobre numero, diga que ainda nao esta ligado',
    'nisso, e nunca invente.'
  )
  return linhas.join('\n')
}

/** Le o mapa mestre do primeiro espelho que tiver um. */
export function lerMapa() {
  for (const repo of REPOS) {
    try {
      const texto = fs.readFileSync(path.join(RAIZ, repo, 'CLAUDE.md'), 'utf8')
      if (texto.trim()) return texto
    } catch {
      /* esse nao tem; tenta o proximo */
    }
  }
  return null
}

/**
 * Abre os olhos: atualiza os espelhos e devolve { mapa, retrato }.
 *
 * Sem `forcar`, devolve o que ja tinha enquanto o retrato estiver fresco —
 * atualizar seis repositorios a cada frase seria absurdo, e o Paulo esta
 * esperando resposta em voz alta.
 */
export async function olhar({ forcar = false } = {}) {
  if (!forcar && cache.retrato && Date.now() - cache.em < VALIDADE_MS) {
    return cache
  }

  fs.mkdirSync(RAIZ, { recursive: true })
  for (const repo of REPOS) await espelhar(repo)

  const repos = []
  for (const repo of REPOS) repos.push(await lerRepo(repo))

  cache = { em: Date.now(), mapa: lerMapa(), retrato: formatarRetrato(repos) }
  return cache
}

/** O que ja se sabe, sem ir ao disco. */
export function ultimoRetrato() {
  return cache
}

/** Ha quanto tempo o Zeus nao olha. Para ele poder dizer em voz alta. */
export function idadeDoRetrato() {
  if (!cache.em) return null
  return Math.round((Date.now() - cache.em) / 60000)
}
