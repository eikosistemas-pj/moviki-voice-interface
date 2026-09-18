// servidor/painel.js  (repo: moviki-voice-interface)
//
// O RETRATO DO ZEUS NO FORMATO COMUM DOS AGENTES.
//
// O CRM do Paulo poe quatro agentes lado a lado numa tela so. O cuidado
// escrito no ESTADO-DO-CRM.md, secao 3.1, e este: se cada agente publicar o
// estado do jeito dele, cada agente novo vira um pedaco de tela novo, e em
// tres agentes a tela vira colcha de retalho. Entao existe UM formato, igual
// para todos, descrito em FORMATO-DO-AGENTE.md — este arquivo e a primeira
// implementacao dele, e serve de exemplo para os outros tres.
//
// A REGRA QUE ATRAVESSA TUDO AQUI: CAMPO SEM DADO E `null`, NUNCA ZERO.
// Zero e uma afirmacao ("gastei zero"), `null` e uma confissao ("nao sei").
// Confundir as duas num painel de controle e o mesmo defeito do Zeus dizendo
// que esta trabalhando quando nao esta — so que em forma de numero.

import * as estado from './estado.js'
import * as gasto from './gasto.js'

/** Sobe quando o formato mudar de um jeito que quebre quem ja lia. */
export const FORMATO = 1

/**
 * A ultima vez que algo deu errado, COM O MOTIVO.
 *
 * "Deu erro" nao serve: o Paulo nao e programador e um erro generico nao diz
 * se ele espera, se tenta de novo ou se te chama. A tarefa guarda o motivo em
 * `erros`, e e ele que sobe para a tela.
 */
export function ultimaFalha(atual, agora = Date.now()) {
  const falhas = (atual.tarefas || [])
    .filter((t) => t.estado === 'falhou')
    .sort((a, b) => String(b.fimEm || b.em).localeCompare(String(a.fimEm || a.em)))
  const f = falhas[0]
  if (!f) return null
  const quando = new Date(f.fimEm || f.em).getTime()
  return {
    em: new Date(quando).toISOString(),
    minutos: Math.max(0, Math.round((agora - quando) / 60000)),
    oQue: f.ordem || f.tipo || 'trabalho',
    motivo: (f.erros || [])[0] || 'nao ficou registrado o motivo',
  }
}

/**
 * O que ele esta fazendo AGORA, com o relogio.
 *
 * O relogio nao e enfeite: foi a falta dele que deixou o Zeus dizer "esta em
 * andamento" por seis horas em 18/09/2026. Lista vazia quer dizer parado, e
 * isso e informacao — nao e ausencia de informacao.
 */
export function oQueFazAgora(atual, agora = Date.now()) {
  return estado.tarefasEmAndamento(atual, agora).map((t) => ({
    oQue: t.ordem || t.tipo || 'trabalho',
    onde: t.repo || null,
    desdeEm: t.em,
    minutos: t.minutos,
  }))
}

/**
 * Monta o retrato inteiro.
 *
 *   atual    o estado lido de servidor/estado.js
 *   subiuEm  quando este processo subiu (para "de pe desde quando")
 *
 * Nao le arquivo nem rede: e chamada dentro de uma rota que o painel consulta
 * de minuto em minuto, e uma tela de controle que custa caro para abrir e uma
 * tela que ninguem abre.
 */
export function montar({ atual, subiuEm = null, agora = Date.now(), resumoGasto } = {}) {
  const estadoAtual = atual || estado.ler()
  const contas = resumoGasto === undefined ? gasto.resumo(new Date(agora)) : resumoGasto
  const teto = Number(process.env.ZEUS_LIMITE_DIA || 200)

  return {
    formato: FORMATO,
    agente: 'zeus',
    nome: 'Zeus',
    papel: 'comando',
    em: new Date(agora).toISOString(),

    // Se esta resposta chegou, ele esta de pe. Quem pergunta e nao recebe
    // nada e que deve mostrar "nao sei" — a ausencia de resposta e a
    // resposta, e nenhum agente consegue avisar que morreu.
    vivo: true,
    desdeEm: subiuEm ? new Date(subiuEm).toISOString() : null,

    ligado: true,

    // A ASSIMETRIA DA SECAO 6.1, EM FORMA DE CAMPO.
    // O Zeus desliga qualquer agente; desligar o Zeus e so do dono. O painel
    // le isto e simplesmente NAO DESENHA o botao — a trava nao pode depender
    // de alguem lembrar de nao clicar.
    podeDesligar: false,
    porQueNaoDesliga: 'desligar o Zeus e so do dono, pela VPS. Decisao do Paulo em 18/09/2026',

    fazendoAgora: oQueFazAgora(estadoAtual, agora),
    ultimaFalha: ultimaFalha(estadoAtual, agora),

    // `null` quando o caderno de despesa ainda nao existe. O painel mostra
    // "nao sei", nunca "R$ 0,00".
    gasto: contas,

    // O teto continua sendo contado em CHAMADAS porque e assim que ele trava.
    // Some com o gasto em reais na mesma tela: um diz quanto custou, o outro
    // diz quanto falta para ele emudecer.
    teto: {
      chamadasHoje: estadoAtual.uso?.dia === estado.diaUTC(new Date(agora))
        ? Number(estadoAtual.uso.chamadas) || 0
        : 0,
      limite: teto,
    },

    // O QUE SO O ZEUS TEM. Fica separado de proposito: as colunas de cima sao
    // iguais para os quatro agentes, e e isso que impede a tela de virar
    // colcha de retalho. Quem nao entender este bloco ignora e a tela
    // continua inteira.
    proprio: {
      turno: estadoAtual.turno?.aberto
        ? { aberto: true, desdeEm: estadoAtual.turno.abertoEm || null }
        : { aberto: false, desdeEm: null },
      feitosNoTurno: estado.trilhaDoTurno(estadoAtual).length,
    },
  }
}

// ---------------------------------------------------------------------------
// QUEM PODE PERGUNTAR DE FORA
// ---------------------------------------------------------------------------
//
// O painel do dono roda no navegador, num endereco que NAO e o do Zeus. Por
// padrao o navegador proibe essa conversa, e a liberacao chama-se CORS.
//
// A liberacao e nominal e nunca `*`. `*` abriria o Zeus para qualquer pagina
// da internet: bastaria o Paulo visitar um site enquanto o cracha dele estava
// valendo. A lista mora no `zeus.env` (ZEUS_PAINEL_ORIGEM), separada por
// virgula, e `*` e recusado com todas as letras mesmo se alguem escrever.

export function origensPermitidas(bruto = process.env.ZEUS_PAINEL_ORIGEM) {
  return String(bruto || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && s !== '*')
}

/** Devolve a origem a devolver no cabecalho, ou `null` se ela nao entra. */
export function origemLiberada(origem, permitidas = origensPermitidas()) {
  if (!origem) return null
  return permitidas.includes(origem) ? origem : null
}
