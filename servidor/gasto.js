// servidor/gasto.js  (repo: moviki-voice-interface)
//
// O CADERNINHO DE DESPESA DO ZEUS.
//
// POR QUE ISTO PASSOU A EXISTIR — 18/09/2026
// O CRM dos agentes tem uma coluna "gastou quanto hoje", e o Paulo decidiu
// que ela aparece em REAIS. Ate aqui o Zeus contava CHAMADAS (o teto do dia),
// que e coisa diferente: uma conversa de duas frases e uma analise de codigo
// contam 1 cada e custam vinte vezes uma da outra. Contar chamada e contar
// passo; o Paulo quer a conta.
//
// POR QUE EM ARQUIVO PROPRIO, E NAO DENTRO DO estado.json
// O `estado.js` e lido inteiro, mexido e regravado inteiro. Uma conversa le o
// estado, pensa por quatro segundos e grava no fim — se a despesa dessa mesma
// conversa fosse anotada no meio, a gravacao do fim passaria por cima dela.
// Caderno separado nao disputa a caneta com ninguem.
//
// A gravacao aqui e sincrona de proposito: em Node nada roda no meio de uma
// funcao sincrona, entao ler-somar-gravar vira um passo so, e duas chamadas
// que terminam juntas nao se atropelam.

import fs from 'node:fs'
import path from 'node:path'
import { centavos, cotacao, emReais, precoDe } from './precos.js'

/** Lido a cada uso, e nao uma vez so: quem troca ZEUS_GASTO na VPS espera
 *  que a troca valha sem reiniciar nada. */
function arquivo() {
  return process.env.ZEUS_GASTO || './dados/gasto.json'
}

const VAZIO = {
  dia: null,
  hoje: { reais: 0, chamadas: 0, semPreco: 0 },
  mes: null,
  noMes: { reais: 0, chamadas: 0, semPreco: 0 },
  porTipo: {},
}

export function diaUTC(agora = new Date()) {
  return agora.toISOString().slice(0, 10)
}

export function mesUTC(agora = new Date()) {
  return agora.toISOString().slice(0, 7)
}

/**
 * Le o caderno. Devolve `null` se ele NUNCA existiu.
 *
 * Isso importa: caderno ausente quer dizer "nao sei quanto gastei", nao
 * "gastei zero". Sao coisas diferentes, e o painel mostra as duas de jeitos
 * diferentes. Zero num painel de custo e uma afirmacao.
 */
export function ler() {
  try {
    return { ...VAZIO, ...JSON.parse(fs.readFileSync(arquivo(), 'utf8')) }
  } catch {
    return null
  }
}

function gravar(livro) {
  const alvo = arquivo()
  fs.mkdirSync(path.dirname(alvo), { recursive: true })
  const tmp = `${alvo}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(livro, null, 2))
  fs.renameSync(tmp, alvo)
}

/** Vira a pagina do dia e a do mes quando a data muda. */
export function virarPagina(livro, agora = new Date()) {
  const dia = diaUTC(agora)
  const mes = mesUTC(agora)
  if (livro.dia !== dia) {
    livro.dia = dia
    livro.hoje = { reais: 0, chamadas: 0, semPreco: 0 }
    livro.porTipo = {}
  }
  if (livro.mes !== mes) {
    livro.mes = mes
    livro.noMes = { reais: 0, chamadas: 0, semPreco: 0 }
  }
  return livro
}

/**
 * Anota uma chamada paga.
 *
 *   tipo    'conversa' | 'analise' | 'trabalho' | 'busca' | 'patrulha'
 *   modelo  o modelo que atendeu
 *   entrada/cache/criacao/saida  tokens, do `usage` da resposta
 *   buscas  quantas pesquisas na internet a chamada fez
 *
 * Nunca lanca. Um erro de contabilidade nao pode derrubar uma resposta ao
 * Paulo — o Zeus mudo e um defeito muito pior que um centavo perdido.
 */
export function anotar(uso = {}, agora = new Date()) {
  try {
    const livro = virarPagina(ler() || { ...VAZIO }, agora)
    const reais = emReais(uso)
    const tipo = String(uso.tipo || 'outro')

    livro.hoje.chamadas += 1
    livro.noMes.chamadas += 1
    if (reais === null) {
      // Modelo fora da tabela: a chamada existiu e foi paga, so nao sabemos
      // quanto. Fica contada aqui para o painel poder dizer "R$ 3,10 mais
      // alguma coisa que eu nao sei" em vez de mentir um total redondo.
      livro.hoje.semPreco += 1
      livro.noMes.semPreco += 1
    } else {
      livro.hoje.reais += reais
      livro.noMes.reais += reais
      livro.porTipo[tipo] = (livro.porTipo[tipo] || 0) + reais
    }
    gravar(livro)
    return livro
  } catch (e) {
    console.error('[zeus] nao consegui anotar o gasto:', e?.message || e)
    return null
  }
}

/**
 * Tira do `usage` da resposta da API os numeros que interessam.
 *
 * Os nomes mudam de lugar entre a resposta inteira e o fluxo, e errar um deles
 * faz o custo aparecer menor do que e — que e o erro mais caro possivel num
 * painel de custo.
 */
export function doUsage(usage = {}) {
  return {
    entrada: usage.input_tokens || 0,
    cache: usage.cache_read_input_tokens || 0,
    criacao: usage.cache_creation_input_tokens || 0,
    saida: usage.output_tokens || 0,
  }
}

/**
 * O resumo que o painel le. `null` quando nao ha caderno nenhum.
 *
 * `semPreco` maior que zero e um aviso, nao um detalhe: quer dizer que o
 * total esta INCOMPLETO. Quem desenhar a tela precisa mostrar isso, senao o
 * numero passa por total quando nao e.
 */
export function resumo(agora = new Date()) {
  const livro = ler()
  if (!livro) return null
  const hoje = livro.dia === diaUTC(agora) ? livro.hoje : { reais: 0, chamadas: 0, semPreco: 0 }
  const mes = livro.mes === mesUTC(agora) ? livro.noMes : { reais: 0, chamadas: 0, semPreco: 0 }
  return {
    moeda: 'BRL',
    dolar: cotacao(),
    hoje: {
      reais: centavos(hoje.reais),
      chamadas: hoje.chamadas,
      semPreco: hoje.semPreco,
      completo: hoje.semPreco === 0,
    },
    mes: {
      reais: centavos(mes.reais),
      chamadas: mes.chamadas,
      semPreco: mes.semPreco,
      completo: mes.semPreco === 0,
    },
    porTipo: Object.fromEntries(
      Object.entries(livro.dia === diaUTC(agora) ? livro.porTipo || {} : {}).map(([k, v]) => [
        k,
        centavos(v),
      ])
    ),
  }
}

/** Serve ao doutor: a tabela conhece este modelo? */
export function temPreco(modelo) {
  return Boolean(precoDe(modelo))
}
