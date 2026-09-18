// lib/turno.test.js  (repo: moviki-voice-interface)
//
// Teste da trava do Zeus. Roda com `npm run teste` — sem servidor, sem banco,
// sem chave. A decisao mora separada justamente para poder ser provada assim.

import test from 'node:test'
import assert from 'node:assert/strict'
import { decidir, PEDIDOS, NUNCA_SOZINHO } from './turno.js'

const FECHADO = { aberto: false }
const ABERTO = { aberto: true, abertoEm: '2026-09-18T10:00:00Z' }

// --- Fora do turno --------------------------------------------------------

test('fora do turno, o Zeus nao decide no lugar do Paulo', () => {
  const r = decidir(FECHADO, { tipo: PEDIDOS.DECIDIR, assunto: 'videoaula' })
  assert.equal(r.permitido, false)
  assert.equal(r.motivo, 'sem_turno')
})

test('fora do turno, ordem direta de trabalho continua valendo', () => {
  const r = decidir(FECHADO, { tipo: PEDIDOS.EXECUTAR, assunto: 'videoaula' })
  assert.equal(r.permitido, true)
  assert.equal(r.motivo, 'ordem_direta')
})

test('turno ausente conta como fechado', () => {
  assert.equal(decidir(undefined, { tipo: PEDIDOS.DECIDIR, assunto: 'x' }).permitido, false)
  assert.equal(decidir({}, { tipo: PEDIDOS.DECIDIR, assunto: 'x' }).permitido, false)
})

// --- Abertura do turno ----------------------------------------------------

test('sem a voz conferida, o turno nao abre', () => {
  const r = decidir(FECHADO, { tipo: PEDIDOS.ABRIR_TURNO, vozConferida: false })
  assert.equal(r.permitido, false)
  assert.equal(r.motivo, 'voz_nao_conferida')
})

test('voz ausente tambem nao abre — so `true` abre', () => {
  assert.equal(decidir(FECHADO, { tipo: PEDIDOS.ABRIR_TURNO }).permitido, false)
  assert.equal(decidir(FECHADO, { tipo: PEDIDOS.ABRIR_TURNO, vozConferida: 'sim' }).permitido, false)
})

test('com a voz conferida, o turno abre', () => {
  const r = decidir(FECHADO, { tipo: PEDIDOS.ABRIR_TURNO, vozConferida: true })
  assert.equal(r.permitido, true)
  assert.equal(r.motivo, 'turno_aberto')
})

// --- Fechamento -----------------------------------------------------------

test('fechar o turno e sempre possivel, mesmo sem a voz conferida', () => {
  // Se o conferidor de voz falhar, o Paulo nao pode ficar trancado do lado de
  // fora enquanto o robo trabalha sozinho.
  const r = decidir(ABERTO, { tipo: PEDIDOS.FECHAR_TURNO, vozConferida: false })
  assert.equal(r.permitido, true)
  assert.equal(r.motivo, 'turno_encerrado')
})

test('fechar um turno ja fechado nao quebra', () => {
  const r = decidir(FECHADO, { tipo: PEDIDOS.FECHAR_TURNO })
  assert.equal(r.permitido, true)
  assert.equal(r.motivo, 'ja_estava_fechado')
})

// --- Assuntos que nunca sao do robo ---------------------------------------

test('assunto vedado e negado MESMO com o turno aberto', () => {
  for (const assunto of NUNCA_SOZINHO) {
    const r = decidir(ABERTO, { tipo: PEDIDOS.DECIDIR, assunto })
    assert.equal(r.permitido, false, `${assunto} deveria ser negado`)
    assert.equal(r.motivo, 'assunto_e_do_paulo')
  }
})

test('assunto vedado tambem nao passa como ordem direta de trabalho', () => {
  // Fechar a porta da decisao e deixar a da execucao aberta nao fecha nada.
  for (const assunto of NUNCA_SOZINHO) {
    const r = decidir(ABERTO, { tipo: PEDIDOS.EXECUTAR, assunto })
    assert.equal(r.permitido, false, `${assunto} deveria ser negado`)
  }
})

test('aprovar Pull Request e mexer em preco estao na lista', () => {
  // Estes dois sao as regras de ouro 1, 2 e 9 do mapa mestre. Se sairem da
  // lista, este teste cai — e e para cair.
  assert.ok(NUNCA_SOZINHO.includes('aprovar_pr'))
  assert.ok(NUNCA_SOZINHO.includes('preco'))
  assert.ok(NUNCA_SOZINHO.includes('dinheiro'))
})

// --- O turno nao vence por tempo ------------------------------------------

test('turno aberto continua aberto depois de meses — decisao do Paulo', () => {
  // 18/09/2026: o Paulo decidiu que o turno NAO tem prazo. Ele abre quando
  // sai e fecha quando chega. Este teste existe para ninguem "consertar" isso
  // achando que faltou um relogio.
  const turnoVelho = { aberto: true, abertoEm: '2020-01-01T00:00:00Z' }
  const r = decidir(turnoVelho, { tipo: PEDIDOS.DECIDIR, assunto: 'videoaula' })
  assert.equal(r.permitido, true)
  assert.equal(r.motivo, 'decisao_no_turno')
})

// --- Pedido desconhecido --------------------------------------------------

test('pedido que ninguem previu para o robo', () => {
  const r = decidir(ABERTO, { tipo: 'transferir_empresa', assunto: 'x' })
  assert.equal(r.permitido, false)
  assert.equal(r.motivo, 'pedido_desconhecido')
})

test('tudo que importa fica na trilha', () => {
  const r = decidir(ABERTO, { tipo: PEDIDOS.DECIDIR, assunto: 'videoaula' })
  assert.equal(r.trilha, true)
})
