// servidor/estado.js  (repo: moviki-voice-interface)
//
// A MEMORIA DO ZEUS, em arquivo na propria VPS.
//
// Guarda quatro coisas:
//   turno      aberto/fechado, quando e por que  (a trava de lib/turno.js)
//   trilha     o que ele fez enquanto o Paulo estava fora
//   uso        quantas chamadas pagas ja foram hoje
//   conversa   as ultimas falas, para ele nao perder o fio
//
// POR QUE NAO NO FIRESTORE
// O Moviki inteiro usa o Firestore como fonte da verdade, e a tentacao era
// por o turno la. Mas escrever no Firestore pela VPS exige levar a chave de
// service account para dentro dela — a mesma chave que alcanca dinheiro,
// assinatura e cadastro de todo lojista. Trocar um arquivo local por espalhar
// a chave mestra num servidor novo e um mau negocio.
//
// O Zeus e o posto de comando do PAULO, nao parte do produto: o estado dele
// nao precisa ser visto pelo painel, pelo robo nem por lojista nenhum. Fica
// em casa.
//
// Se um dia a trilha precisar aparecer no painel do dono, o caminho certo e o
// Zeus MANDAR para um endpoint do moviki-robo, que ja tem a chave — nunca a
// VPS ganhar a chave.

import fs from 'node:fs'
import path from 'node:path'

const ARQUIVO = process.env.ZEUS_ESTADO || './dados/estado.json'

/** Quantas falas do Paulo o Zeus carrega de contexto. ~10 idas e vindas. */
const MAX_CONVERSA = 20

/** Quantos itens da trilha ficam guardados antes de o mais velho cair. */
const MAX_TRILHA = 200

const VAZIO = {
  turno: { aberto: false },
  trilha: [],
  uso: { dia: null, chamadas: 0 },
  conversa: [],
}

export function ler() {
  try {
    const bruto = fs.readFileSync(ARQUIVO, 'utf8')
    return { ...VAZIO, ...JSON.parse(bruto) }
  } catch {
    // Arquivo ausente ou corrompido: comeca fechado. Na duvida o Zeus NAO
    // esta no comando — errar para o lado de parar nao custa nada.
    return { ...VAZIO }
  }
}

export function gravar(estado) {
  const dir = path.dirname(ARQUIVO)
  fs.mkdirSync(dir, { recursive: true })
  // Grava num temporario e troca: queda de energia no meio da escrita deixa o
  // arquivo antigo inteiro em vez de um pela metade que nao abre mais.
  const tmp = `${ARQUIVO}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(estado, null, 2))
  fs.renameSync(tmp, ARQUIVO)
}

/** Dia de hoje em UTC, no mesmo formato que o resto do Moviki usa. */
export function diaUTC(agora = new Date()) {
  return agora.toISOString().slice(0, 10)
}

/**
 * Teto de chamadas pagas por dia.
 *
 * Existe pela mesma razao do teto do atendente do WhatsApp: cada fala do Zeus
 * e uma chamada paga a Anthropic, e uma porta na internet nao tem fundo. Se o
 * endereco vazar, o prejuizo para no teto em vez de crescer a noite toda.
 */
export function passouDoTeto(estado, limite, agora = new Date()) {
  const hoje = diaUTC(agora)
  const mesmoDia = estado.uso?.dia === hoje
  const chamadas = mesmoDia ? Number(estado.uso.chamadas) || 0 : 0
  return { chamadas, estourou: chamadas >= limite, hoje }
}

export function contarChamada(estado, agora = new Date()) {
  const hoje = diaUTC(agora)
  const mesmoDia = estado.uso?.dia === hoje
  estado.uso = {
    dia: hoje,
    chamadas: (mesmoDia ? Number(estado.uso.chamadas) || 0 : 0) + 1,
  }
  return estado
}

/** Registra na trilha o que o Paulo vai querer ler quando chegar. */
export function anotar(estado, item) {
  estado.trilha = [
    ...(estado.trilha || []),
    { em: new Date().toISOString(), ...item },
  ].slice(-MAX_TRILHA)
  return estado
}

export function lembrarFala(estado, papel, texto) {
  estado.conversa = [...(estado.conversa || []), { papel, texto }].slice(-MAX_CONVERSA)
  return estado
}

// ---------------------------------------------------------------------------
// AS TAREFAS — trabalho que corre por fora da conversa
// ---------------------------------------------------------------------------
//
// Mexer no codigo leva minutos; a conversa e em voz alta. Entao o Zeus diz
// "vou trabalhar nisso" na hora e o trabalho corre por fora. Quando termina,
// o resultado fica guardado aqui ate ele conseguir contar — na proxima vez
// que o Paulo falar, ou no relatorio de chegada.
//
// Sem essa fila, o Paulo ficaria ouvindo silencio por dois minutos, ou pior:
// descobriria o Pull Request por acaso, dias depois, sem lembrar de ter
// pedido.

export function abrirTarefa(estado, { ordem, repo }) {
  const id = `t${Date.now().toString(36)}`
  estado.tarefas = [
    ...(estado.tarefas || []),
    { id, ordem, repo, estado: 'trabalhando', em: new Date().toISOString(), contada: false },
  ].slice(-50)
  return id
}

export function fecharTarefa(estado, id, resultado) {
  estado.tarefas = (estado.tarefas || []).map((t) =>
    t.id === id
      ? { ...t, ...resultado, estado: resultado.ok ? 'pronta' : 'falhou', fimEm: new Date().toISOString() }
      : t
  )
  return estado
}

/** O que ele ainda nao conseguiu contar ao Paulo. */
export function tarefasParaContar(estado) {
  return (estado.tarefas || []).filter((t) => !t.contada && t.estado !== 'trabalhando')
}

export function marcarContadas(estado) {
  estado.tarefas = (estado.tarefas || []).map((t) =>
    t.estado === 'trabalhando' ? t : { ...t, contada: true }
  )
  return estado
}

/** O que o Zeus fez desde que o turno abriu — o relatorio de chegada. */
export function trilhaDoTurno(estado) {
  const desde = estado.turno?.abertoEm
  if (!desde) return []
  return (estado.trilha || []).filter((i) => i.em >= desde)
}
