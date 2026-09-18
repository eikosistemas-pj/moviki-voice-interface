// servidor/proposta.js  (repo: moviki-voice-interface)
//
// COMO O TRABALHO DO ZEUS VIRA PULL REQUEST.
//
// Uma PROPOSTA e um conjunto de alteracoes em arquivos, num ramo proprio. O
// Zeus monta; a oficina executa; o Paulo aprova. Ele nunca publica.
//
// ---------------------------------------------------------------------------
// POR QUE ALTERACAO E TROCA DE TRECHO, E NAO ARQUIVO INTEIRO — 18/09/2026
// ---------------------------------------------------------------------------
// A primeira versao mandava o Zeus devolver o arquivo COMPLETO. Parecia mais
// simples e era um erro de projeto, descoberto no primeiro uso real: o Paulo
// pediu para trocar a cor de um botao e o Zeus ficou dez minutos sem entregar
// nada.
//
// O motivo estava no tamanho dos arquivos do Moviki:
//
//   moviki-app/index.html      568.633 caracteres
//   moviki-app/parceiro.html   327.492
//   moviki/404.html            264.808
//
// Nenhum modelo devolve meio milhao de caracteres numa resposta. Ele lia um
// pedaco truncado, tentava reescrever o todo, batia no teto e recomecava —
// dez minutos queimando dinheiro contra uma parede.
//
// Agora a alteracao diz o TRECHO a procurar e o TRECHO a colocar no lugar.
// Trocar uma cor passa a custar algumas dezenas de caracteres em vez de meio
// milhao. E de quebra ficou mais seguro: quem troca um pedaco nao apaga o
// resto do arquivo sem querer.
//
// A ANCORA PRECISA SER UNICA
// Se o trecho procurado aparecer duas vezes, nao da para saber qual delas ele
// queria. A conferencia disso exige o arquivo em maos e mora na oficina; aqui
// ficam as regras que dispensam o disco.

import { podeMexer, ramoValido } from './maos.js'

/** Quantos arquivos uma proposta pode tocar de uma vez. */
const MAX_ARQUIVOS = 12

/**
 * Menor ancora aceita.
 *
 * Ancora curta ("div", "azul") casa em cem lugares do arquivo e a troca cai
 * no lugar errado. Exigir um trecho com tamanho obriga o Zeus a citar algo
 * que ele realmente leu.
 */
const MIN_ANCORA = 12

/** Teto por trecho. Acima disso ele esta reescrevendo o arquivo de novo. */
const MAX_TRECHO = 20_000

/** Teto para arquivo novo, que nao tem ancora por nao existir ainda. */
const MAX_ARQUIVO_NOVO = 60_000

function validarAlteracao(repo, a, erros) {
  const caminho = a?.caminho
  if (!caminho) {
    erros.push('tem alteracao sem nome de arquivo')
    return
  }

  const veredito = podeMexer(repo, caminho)
  if (!veredito.permitido) {
    erros.push(`${caminho}: ${veredito.motivo}`)
    return
  }

  const ehTroca = typeof a.procurar === 'string'
  const ehNovo = typeof a.conteudo === 'string'

  if (ehTroca && ehNovo) {
    erros.push(`${caminho}: ou troca um trecho, ou cria o arquivo — nao os dois`)
    return
  }
  if (!ehTroca && !ehNovo) {
    erros.push(`${caminho}: nao veio nem trecho para trocar nem arquivo novo`)
    return
  }

  if (ehNovo) {
    if (a.conteudo.length > MAX_ARQUIVO_NOVO) {
      erros.push(`${caminho}: arquivo novo grande demais`)
    }
    return
  }

  if (a.procurar.trim().length < MIN_ANCORA) {
    // Ancora curta casa em cem lugares e a troca cai no lugar errado.
    erros.push(`${caminho}: o trecho a procurar e curto demais para eu ter certeza de onde e`)
  }
  if (typeof a.trocar_por !== 'string') {
    erros.push(`${caminho}: nao veio o trecho novo`)
    return
  }
  if (a.procurar === a.trocar_por) {
    erros.push(`${caminho}: o trecho novo e igual ao antigo; isso nao muda nada`)
  }
  if (a.procurar.length > MAX_TRECHO || a.trocar_por.length > MAX_TRECHO) {
    erros.push(`${caminho}: o trecho e grande demais; troque so o pedaco que muda`)
  }
}

/**
 * A proposta pode seguir?
 *
 *   { repo, ramo, titulo, resumo, arquivos: [
 *       { caminho, procurar, trocar_por }   // troca um trecho
 *       { caminho, conteudo }               // cria um arquivo novo
 *   ]}
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

  for (const a of arquivos) validarAlteracao(p.repo, a, erros)

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

/**
 * Aplica uma troca num texto. Devolve { ok, texto } ou { ok:false, erro }.
 *
 * Separado do disco para poder ser testado, e usado nos DOIS lados: o Zeus
 * confere antes de propor (e corrige sozinho se errar a ancora) e a oficina
 * confere de novo antes de gravar.
 */
export function aplicarTroca(textoAtual, alteracao) {
  const { procurar, trocar_por: trocarPor } = alteracao
  const partes = String(textoAtual).split(procurar)

  if (partes.length === 1) {
    return { ok: false, erro: 'nao achei esse trecho no arquivo' }
  }
  if (partes.length > 2) {
    // Duas ocorrencias e nao da para saber qual delas ele queria. Melhor
    // recusar do que trocar a errada e o Paulo descobrir no ar.
    return {
      ok: false,
      erro: `esse trecho aparece ${partes.length - 1} vezes; preciso de um pedaco maior para saber qual e`,
    }
  }
  return { ok: true, texto: partes.join(trocarPor) }
}
