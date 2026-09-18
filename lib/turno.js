// lib/turno.js  (repo: moviki-voice-interface)
//
// A TRAVA DO ZEUS — quem pode mandar, e ate onde.
//
// POR QUE EXISTE — 18/09/2026
// O Zeus nao e atendente de cliente: e o posto de comando do Paulo. Ele
// aciona as cadeiras do time (Gabinete, Tesouraria, Guarda...) e, quando o
// Paulo nao esta, decide no lugar dele. Poder desse tamanho sem trava e
// questao de tempo ate alguem falar perto da tela e o robo obedecer.
//
// A REGRA, NA BOCA DO PAULO
//   "Quando eu pedir para ele assumir, ele assume. So para quando eu disser
//    que pare. Quando eu chegar, eu digo: Zeus, acabei de chegar."
//
// Entao o turno NAO VENCE POR TEMPO — de proposito, por decisao dele
// (18/09/2026). Nao existe relogio aqui. Um turno aberto continua aberto por
// quantos dias forem, ate a ordem de fechar. Ha um teste abaixo cravando esse
// comportamento, para ninguem "consertar" isso achando que e esquecimento.
//
// ESTA TRAVA NAO PODE MORAR NA TELA
// O que roda no navegador qualquer um edita com o console aberto. Este modulo
// e a DECISAO, sem tela e sem banco, para rodar no servidor e ter teste de
// verdade — mesmo padrao do tetoDia.js do moviki-ai. Quem chama grava o
// resultado; quem decide e aqui.
//
// POR QUE A DECISAO VIVE SEPARADA DO BANCO
// O endpoint depende de Firestore e do reconhecimento de voz; esta funcao nao
// depende de nada. Da para provar a regra sem subir servico nenhum.

/**
 * Assuntos que o Zeus NUNCA resolve sozinho — nem com o turno aberto, nem com
 * o Paulo tendo autorizado de vespera.
 *
 * Isto nao e excesso de zelo: sao as regras de ouro do Moviki. Se o robo puder
 * furar uma delas, ela deixa de existir na pratica. Cada linha aqui tem dono
 * no mapa mestre (CLAUDE.md, secao 4).
 */
export const NUNCA_SOZINHO = [
  'aprovar_pr',   // aprovar/juntar Pull Request encerra pacote — e do Paulo
  'preco',        // preco e plano so mudam com confirmacao dele
  'dinheiro',     // Asaas, comissao, saque, cobranca
  'seguranca',    // regra do Firestore/Storage, LGPD
  'segredo',      // chave, token, variavel de ambiente
  'publicar',     // falar em nome do Moviki nas redes
  'apagar',       // remover repositorio, colecao, arquivo, conta
]

/** O que se pede ao Zeus. */
export const PEDIDOS = {
  /** Mandar uma cadeira trabalhar. E ordem direta: vale com ou sem turno. */
  EXECUTAR: 'executar',
  /** Escolher no lugar do Paulo. So com o turno aberto. */
  DECIDIR: 'decidir',
  /** "Zeus, assuma daqui." */
  ABRIR_TURNO: 'abrir_turno',
  /** "Zeus, acabei de chegar." */
  FECHAR_TURNO: 'fechar_turno',
}

/**
 * Decide se o Zeus pode atender ao pedido.
 *
 *   turno    { aberto: boolean, ... } — o registro guardado no servidor.
 *            Ausente ou {} conta como FECHADO: na duvida, o robo nao manda.
 *   pedido   { tipo, assunto, vozConferida }
 *            vozConferida = o conferidor de voz reconheceu o Paulo.
 *
 * Devolve:
 *   permitido  o Zeus pode seguir
 *   motivo     codigo curto, para a trilha e para o Zeus explicar em voz
 *   trilha     este pedido precisa ficar registrado para o Paulo ler depois
 */
export function decidir(turno, pedido) {
  const t = turno || {}
  const p = pedido || {}
  const aberto = t.aberto === true

  // --- Fechar o turno e sempre possivel. -----------------------------------
  // Fechar e facil, abrir e dificil. Se o conferidor de voz falhar, o Paulo
  // nao pode ficar trancado do lado de fora do proprio robo enquanto ele
  // trabalha sozinho. Errar para o lado de parar nao custa nada; errar para o
  // lado de continuar custa o negocio.
  if (p.tipo === PEDIDOS.FECHAR_TURNO) {
    return { permitido: true, motivo: aberto ? 'turno_encerrado' : 'ja_estava_fechado', trilha: true }
  }

  // --- Abrir turno exige a voz conferida. ----------------------------------
  // E o comando mais perigoso do sistema: e o unico que precisa de prova.
  if (p.tipo === PEDIDOS.ABRIR_TURNO) {
    if (p.vozConferida !== true) {
      return { permitido: false, motivo: 'voz_nao_conferida', trilha: true }
    }
    if (aberto) {
      return { permitido: false, motivo: 'turno_ja_aberto', trilha: false }
    }
    return { permitido: true, motivo: 'turno_aberto', trilha: true }
  }

  // --- Assunto vedado para de pe, em qualquer situacao. --------------------
  // Vem ANTES da conferencia de turno de proposito: com o turno aberto ou
  // fechado, a resposta e a mesma. Assunto vedado nao e caso de "so com
  // permissao": e caso de nao ser do robo.
  if (NUNCA_SOZINHO.includes(p.assunto)) {
    return { permitido: false, motivo: 'assunto_e_do_paulo', trilha: true }
  }

  // --- Mandar trabalhar e ordem direta: nao depende de turno. --------------
  // O Paulo falando com o Zeus na frente da tela nao precisa de procuracao
  // para pedir trabalho — ele esta ali.
  if (p.tipo === PEDIDOS.EXECUTAR) {
    return { permitido: true, motivo: 'ordem_direta', trilha: true }
  }

  // --- Decidir no lugar do Paulo so dentro do turno. -----------------------
  if (p.tipo === PEDIDOS.DECIDIR) {
    if (!aberto) {
      return { permitido: false, motivo: 'sem_turno', trilha: true }
    }
    return { permitido: true, motivo: 'decisao_no_turno', trilha: true }
  }

  // --- Pedido que ninguem previu. ------------------------------------------
  // Na duvida ele para e deixa anotado. Robo que trava e aborrecimento; robo
  // que decide errado no lugar do dono e prejuizo.
  return { permitido: false, motivo: 'pedido_desconhecido', trilha: true }
}
