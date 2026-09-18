// servidor/oficina.js  (repo: moviki-voice-interface)
//
// A OFICINA — onde a proposta do Zeus vira Pull Request.
//
// Nenhuma decisao mora aqui. A oficina executa o que `proposta.validar` ja
// aprovou e recusa o que chegar sem esse carimbo. Quem decide e a trava; quem
// executa nao opina.
//
// A OFICINA NAO E O ESPELHO
// Os olhos leem de `/root/eikosistemas/<repo>`, que e so leitura. A oficina
// trabalha em `/root/eikosistemas/.oficina/<repo>`, separada. Misturar as duas
// faria o Zeus responder perguntas lendo um repositorio que ele mesmo acabou
// de sujar com trabalho pela metade.
//
// O QUE ELA NUNCA FAZ
// Nunca muda para a main. Nunca faz merge. Nunca apaga branch. Nunca roda
// comando vindo de fora — os unicos comandos sao os escritos neste arquivo,
// com argumentos passados em LISTA, nunca montados como texto de terminal
// (que e como se abre porta para comando disfarcado de nome de arquivo).
//
// ENV (na VPS):
//   ZEUS_GITHUB_TOKEN  token restrito: so os quatro repositorios permitidos,
//                      so conteudo e pull request, sem administracao.

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import fs from 'node:fs/promises'
import path from 'node:path'
import { REPOS_PERMITIDOS } from './maos.js'
import { aplicarTroca, validar } from './proposta.js'

const executar = promisify(execFile)

const DONO = 'eikosistemas-pj'
const RAIZ = process.env.ZEUS_OFICINA || '/root/eikosistemas/.oficina'

async function git(pasta, args, tempo = 120_000) {
  const { stdout } = await executar('git', ['-C', pasta, ...args], {
    timeout: tempo,
    maxBuffer: 4 * 1024 * 1024,
  })
  return stdout.trim()
}

function urlComToken(repo) {
  const token = process.env.ZEUS_GITHUB_TOKEN
  if (!token) throw new Error('sem ZEUS_GITHUB_TOKEN na VPS')
  return `https://x-access-token:${token}@github.com/${DONO}/${repo}.git`
}

/** Prepara a copia de trabalho no estado da main, limpa. */
async function prepararCopia(repo) {
  const pasta = path.join(RAIZ, repo)
  await fs.mkdir(RAIZ, { recursive: true })

  try {
    await fs.access(path.join(pasta, '.git'))
  } catch {
    await executar('git', ['clone', '--depth', '1', urlComToken(repo), pasta], {
      timeout: 300_000,
    })
    return pasta
  }

  // Volta ao estado da main, jogando fora sobra de trabalho anterior. A
  // oficina nao guarda rascunho entre ordens: rascunho esquecido vira
  // alteracao surpresa no Pull Request seguinte.
  await git(pasta, ['fetch', '--depth', '1', 'origin', 'main'], 180_000)
  await git(pasta, ['checkout', '-B', 'base-temporaria', 'FETCH_HEAD'])
  await git(pasta, ['reset', '--hard', 'FETCH_HEAD'])
  await git(pasta, ['clean', '-fd'])
  return pasta
}

async function abrirPullRequest({ repo, ramo, titulo, corpo }) {
  const token = process.env.ZEUS_GITHUB_TOKEN
  const resp = await fetch(`https://api.github.com/repos/${DONO}/${repo}/pulls`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title: titulo, head: ramo, base: 'main', body: corpo }),
  })
  if (!resp.ok) {
    const detalhe = await resp.text().catch(() => '')
    throw new Error(`o GitHub recusou (${resp.status}): ${detalhe.slice(0, 200)}`)
  }
  const dados = await resp.json()
  return dados.html_url
}

/**
 * Executa uma proposta. Devolve { ok, link } ou { ok:false, erros }.
 *
 * Confere de novo antes de tocar em qualquer coisa: conferir duas vezes custa
 * microssegundos, nao conferir custa um Pull Request que ninguem pediu.
 */
export async function executarProposta(proposta) {
  const conferencia = validar(proposta)
  if (!conferencia.ok) return { ok: false, erros: conferencia.erros }

  const { repo, ramo, titulo, arquivos } = proposta
  if (!REPOS_PERMITIDOS.includes(repo)) {
    return { ok: false, erros: ['esse repositorio nao e meu'] }
  }

  const pasta = await prepararCopia(repo)
  await git(pasta, ['checkout', '-b', ramo])

  for (const a of arquivos) {
    const destino = path.join(pasta, a.caminho)
    // Conferencia final sobre o caminho JA resolvido: e a unica que pega um
    // caminho que so escapa depois de juntado com a pasta.
    if (!path.resolve(destino).startsWith(path.resolve(pasta) + path.sep)) {
      return { ok: false, erros: [`${a.caminho}: sai da pasta do projeto`] }
    }

    if (typeof a.procurar === 'string') {
      // TROCA DE TRECHO. A ancora ja foi conferida contra o espelho em
      // trabalho.js, mas e conferida DE NOVO aqui, contra a copia de
      // trabalho: entre uma coisa e outra alguem pode ter mexido no
      // repositorio, e trocar no lugar errado e pior que nao trocar.
      let atual = ''
      try {
        atual = await fs.readFile(destino, 'utf8')
      } catch {
        return { ok: false, erros: [`${a.caminho}: esse arquivo nao existe`] }
      }
      const r = aplicarTroca(atual, a)
      if (!r.ok) return { ok: false, erros: [`${a.caminho}: ${r.erro}`] }
      await fs.writeFile(destino, r.texto, 'utf8')
      continue
    }

    // ARQUIVO NOVO. Se ja existir, isto seria sobrescrever as cegas — o
    // caminho para apagar trabalho alheio sem nem ter lido.
    try {
      await fs.access(destino)
      return {
        ok: false,
        erros: [`${a.caminho}: esse arquivo ja existe; troque um trecho dele`],
      }
    } catch {
      /* nao existe, e e isso que se espera de arquivo novo */
    }
    await fs.mkdir(path.dirname(destino), { recursive: true })
    await fs.writeFile(destino, a.conteudo, 'utf8')
  }

  await git(pasta, ['add', '--', ...arquivos.map((a) => a.caminho)])

  const mudou = await git(pasta, ['status', '--porcelain'])
  if (!mudou) {
    return { ok: false, erros: ['isso ja estava assim; nao mudei nada'] }
  }

  await git(pasta, [
    '-c',
    'user.name=Zeus',
    '-c',
    'user.email=eikosistemas@gmail.com',
    'commit',
    '-m',
    titulo,
  ])
  await git(pasta, ['push', urlComToken(repo), `${ramo}:${ramo}`], 300_000)

  const corpo = [
    proposta.resumo || '',
    '',
    '---',
    'Proposto pelo **Zeus**, a pedido do Paulo, por voz.',
    'Ele não aprova nem junta Pull Request — isso continua sendo do Paulo.',
  ].join('\n')

  const link = await abrirPullRequest({ repo, ramo, titulo, corpo })
  return { ok: true, link }
}
