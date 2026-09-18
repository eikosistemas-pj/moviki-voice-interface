import test from 'node:test'
import assert from 'node:assert/strict'
import { montar, oQueFazAgora, origemLiberada, origensPermitidas, ultimaFalha } from './painel.js'

const MIN = 60 * 1000

// ---------------------------------------------------------------------------
// O FORMATO COMUM — o que a tela dos agentes precisa, e nada de invencao
// ---------------------------------------------------------------------------

test('o retrato traz as colunas que o CRM desenha', () => {
  const agora = Date.now()
  const r = montar({ atual: { turno: { aberto: false } }, subiuEm: agora - 5 * MIN, agora, resumoGasto: null })
  for (const campo of ['formato', 'agente', 'vivo', 'fazendoAgora', 'ultimaFalha', 'gasto', 'ligado']) {
    assert.ok(campo in r, `falta a coluna ${campo}`)
  }
  assert.equal(r.agente, 'zeus')
  assert.equal(r.vivo, true)
  assert.equal(r.desdeEm, new Date(agora - 5 * MIN).toISOString())
})

// A ASSIMETRIA DA SECAO 6.1 DO ESTADO-DO-CRM.md
//
// O Zeus desliga qualquer agente; desligar o Zeus e so do dono. Aqui isso
// vira campo, e o painel simplesmente nao desenha o botao — trava que depende
// de alguem lembrar de nao clicar nao e trava.
test('o Zeus nunca se oferece para ser desligado pela tela', () => {
  const r = montar({ atual: {}, resumoGasto: null })
  assert.equal(r.podeDesligar, false)
  assert.ok(r.porQueNaoDesliga)
})

test('o que ele faz agora vem com o relogio, como no prompt dele', () => {
  const agora = Date.now()
  const atual = {
    tarefas: [
      { id: 't1', ordem: 'muda a cor do botao', repo: 'moviki-app', estado: 'trabalhando', em: new Date(agora - 7 * MIN).toISOString() },
      { id: 't2', ordem: 'ja acabou', estado: 'pronta', em: new Date(agora - 30 * MIN).toISOString() },
    ],
  }
  const fazendo = oQueFazAgora(atual, agora)
  assert.equal(fazendo.length, 1)
  assert.equal(fazendo[0].minutos, 7)
  assert.equal(fazendo[0].onde, 'moviki-app')
})

test('parado e parado: lista vazia, e isso e informacao', () => {
  assert.deepEqual(oQueFazAgora({ tarefas: [] }, Date.now()), [])
})

// ---------------------------------------------------------------------------
// A ULTIMA FALHA VEM COM O MOTIVO
// ---------------------------------------------------------------------------
//
// "Deu erro" nao serve para quem nao e programador: nao diz se ele espera, se
// manda tentar de novo, ou se o problema e outro.

test('a ultima falha traz o motivo com todas as letras, e e a mais recente', () => {
  const agora = Date.now()
  const atual = {
    tarefas: [
      { id: 'a', ordem: 'velha', estado: 'falhou', erros: ['nao achei o arquivo'], em: new Date(agora - 3 * 60 * MIN).toISOString(), fimEm: new Date(agora - 3 * 60 * MIN).toISOString() },
      { id: 'b', ordem: 'mexer no painel', estado: 'falhou', erros: ['parei no meio e nao voltei'], em: new Date(agora - 20 * MIN).toISOString(), fimEm: new Date(agora - 10 * MIN).toISOString() },
    ],
  }
  const f = ultimaFalha(atual, agora)
  assert.equal(f.oQue, 'mexer no painel')
  assert.equal(f.motivo, 'parei no meio e nao voltei')
  assert.equal(f.minutos, 10)
})

test('sem falha nenhuma o campo e nao sei, nao um erro em branco', () => {
  assert.equal(ultimaFalha({ tarefas: [] }), null)
})

// ---------------------------------------------------------------------------
// ZERO E "NAO SEI" SAO COISAS DIFERENTES
// ---------------------------------------------------------------------------

test('sem caderno de despesa o gasto e nao sei, nunca R$ 0,00', () => {
  const r = montar({ atual: {}, resumoGasto: null })
  assert.equal(r.gasto, null)
})

test('com caderno, o gasto do dia sobe inteiro para a tela', () => {
  const contas = { moeda: 'BRL', hoje: { reais: 3.2, chamadas: 9, semPreco: 0, completo: true } }
  const r = montar({ atual: {}, resumoGasto: contas })
  assert.equal(r.gasto.hoje.reais, 3.2)
})

// ---------------------------------------------------------------------------
// QUEM PODE PERGUNTAR DE FORA
// ---------------------------------------------------------------------------

test('so a origem escrita no zeus.env entra', () => {
  const lista = origensPermitidas('https://painel.moviki.com.br')
  assert.equal(origemLiberada('https://painel.moviki.com.br', lista), 'https://painel.moviki.com.br')
  assert.equal(origemLiberada('https://site-qualquer.com', lista), null)
  assert.equal(origemLiberada(undefined, lista), null)
})

// `*` abriria o Zeus para QUALQUER pagina da internet: bastaria o Paulo
// visitar um site enquanto o cracha dele estava valendo. Nao se aceita nem
// escrito de proposito.
test('asterisco nao vale nem se alguem escrever na configuracao', () => {
  assert.deepEqual(origensPermitidas('*'), [])
  assert.equal(origemLiberada('https://site-qualquer.com', origensPermitidas('*')), null)
})

test('aceita mais de uma origem, separada por virgula', () => {
  const lista = origensPermitidas(' https://a.com , https://b.com ')
  assert.deepEqual(lista, ['https://a.com', 'https://b.com'])
  assert.equal(origemLiberada('https://b.com', lista), 'https://b.com')
})

test('sem nada configurado, ninguem de fora entra', () => {
  assert.deepEqual(origensPermitidas(''), [])
  assert.equal(origemLiberada('https://a.com', origensPermitidas('')), null)
})
