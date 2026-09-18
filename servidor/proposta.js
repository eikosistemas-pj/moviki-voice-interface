// servidor/proposta.js  (repo: moviki-voice-interface)
//
// COMO O TRABALHO DO ZEUS VIRA PULL REQUEST.
//
// Uma PROPOSTA e um conjunto de alteracoes em arquivos, num ramo proprio. O
// Zeus monta; a oficina executa; o Paulo aprova. Ele nunca publica.
//
// POR QUE A CONFERENCIA VIVE SEPARADA DA EXECUCAO
// `validar` nao toca em disco, nem em git, nem em rede. Da para provar as
// regras inteiras com teste, sem repositorio nenhum — mesmo padrao do
// tetoDia.js do moviki-ai e da trava do turno.
//
// E ela roda SEMPRE, mesmo com o cerebro instruido a nao pedir nada proibido.
// Instrucao e pedido; isto e trava. A diferenca aparece no dia em que alguem
// convencer o cerebro a pedir outra coisa.

import { podeMexer, ramoValido } from './maos.js'

/** Quantos arquivos uma proposta pode tocar de uma vez. */
const MAX_ARQUIVOS = 12

/** Tamanho maximo de um arquivo escrito, em caracteres. */
const MAX_TAMANHO = 200_000

/**
 * A proposta pode seguir?
 *
 *   { repo, ramo, titulo, resumo, arquivos: [{ caminho, conteudo }] }
 *
 * Os erros saem em portugues falado: eles vao pela boca do Zeus na recusa.
 */
export function validar(proposta) {
  const erros = []
  const p = proposta || {}

  if (!p.repo) erros.push('nao sei em qual repositorio mexer')

  if (!ramoValido(p.ramo)) {
    erros.push(
      p.ramo === 'main' || p.ramo === 'master'
        ? 'nao mando nada direto para a main'
        : 'o nome do ramo nao serve'
    )
  }

  if (!p.titulo || String(p.titulo).trim().length < 8) {
    erros.push('falta um titulo que explique a alteracao')
  }

  const arquivos = Array.isArray(p.arquivos) ? p.arquivos : []
  if (arquivos.length === 0) erros.push('a proposta nao altera nada')
  if (arquivos.length > MAX_ARQUIVOS) {
    // Proposta gigante e proposta que ninguem revisa. Se precisar de mais que
    // isso, e trabalho para ser partido em pedacos que o Paulo consiga ler.
    erros.push(`mexe em arquivos demais (${arquivos.length})`)
  }

  const vistos = new Set()
  for (const a of arquivos) {
    const caminho = a?.caminho
    if (!caminho) {
      erros.push('tem alteracao sem nome de arquivo')
      continue
    }
    if (vistos.has(caminho)) {
      // Senao a segunda escrita apaga a primeira em silencio.
      erros.push(`o mesmo arquivo aparece duas vezes: ${caminho}`)
      continue
    }
    vistos.add(caminho)

    const veredito = podeMexer(p.repo, caminho)
    if (!veredito.permitido) {
      erros.push(`${caminho}: ${veredito.motivo}`)
      continue
    }
    if (typeof a.conteudo !== 'string') {
      erros.push(`${caminho}: nao veio conteudo`)
      continue
    }
    if (a.conteudo.length > MAX_TAMANHO) {
      erros.push(`${caminho}: arquivo grande demais`)
    }
  }

  return { ok: erros.length === 0, erros }
}

/**
 * Um nome de ramo a partir do que o Paulo pediu.
 *
 * O carimbo de hora no fim evita colisao quando ele pede duas vezes a mesma
 * coisa no mesmo dia — ramo que ja existe faz o envio falhar no meio.
 */
export function nomearRamo(pedido, agora = new Date()) {
  const base = String(pedido || 'trabalho')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '')

  const carimbo = agora.toISOString().slice(5, 16).replace(/[-:T]/g, '')
  return `zeus/${base || 'trabalho'}-${carimbo}`
}
