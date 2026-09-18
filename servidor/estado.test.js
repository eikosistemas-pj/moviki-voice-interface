import test from 'node:test'
import assert from 'node:assert/strict'
import { enterrarOrfas, tarefasEmAndamento, tarefasParaContar } from './estado.js'

// ---------------------------------------------------------------------------
// NENHUMA TAREFA PODE SER IMORTAL
// ---------------------------------------------------------------------------
//
// 18/09/2026: o Paulo pediu a cor de um botao de manha e a tarde o Zeus ainda
// dizia "esta em andamento". A tarefa tinha morrido e ficado gravada como
// "trabalhando" para sempre — e tarefa "trabalhando" nao entra na fila do que
// ele tem para contar, entao o aviso nunca vinha.

const MIN = 60 * 1000

function estadoCom(tarefas) {
  return { tarefas }
}

test('tarefa em andamento aparece com o relogio', () => {
  const agora = Date.now()
  const e = estadoCom([
    { id: 't1', ordem: 'muda a cor do botao', repo: 'moviki-app', estado: 'trabalhando', em: new Date(agora - 7 * MIN).toISOString() },
  ])
  const andando = tarefasEmAndamento(e, agora)
  assert.equal(andando.length, 1)
  assert.equal(andando[0].minutos, 7)
})

test('restart enterra quem estava trabalhando', () => {
  // Quem trabalhava vivia na memoria do processo que morreu. Nao ha o que
  // esperar: ou vira falha agora, ou fica imortal para sempre.
  const agora = Date.now()
  const e = estadoCom([
    { id: 't1', ordem: 'muda a cor', estado: 'trabalhando', em: new Date(agora - 30 * 1000).toISOString() },
    { id: 't2', ordem: 'ja pronta', estado: 'pronta', ok: true, contada: true, em: new Date(agora).toISOString() },
  ])
  const mortas = enterrarOrfas(e, { limiteMs: 0, motivo: 'o servidor reiniciou', agora })

  assert.equal(mortas.length, 1)
  assert.equal(e.tarefas[0].estado, 'falhou')
  assert.equal(e.tarefas[0].ok, false)
  // E o mais importante: agora ela ENTRA na fila do que ele tem para contar.
  assert.equal(tarefasParaContar(e).length, 1)
  // A que ja estava pronta e contada nao pode ser mexida.
  assert.equal(e.tarefas[1].estado, 'pronta')
})

test('a ronda so enterra quem passou do prazo', () => {
  const agora = Date.now()
  const e = estadoCom([
    { id: 'nova', ordem: 'comecou agora', estado: 'trabalhando', em: new Date(agora - 2 * MIN).toISOString() },
    { id: 'velha', ordem: 'de manha', estado: 'trabalhando', em: new Date(agora - 300 * MIN).toISOString() },
  ])
  const mortas = enterrarOrfas(e, { limiteMs: 12 * MIN, motivo: 'passou do prazo', agora })

  assert.deepEqual(mortas.map((t) => t.id), ['velha'])
  assert.equal(e.tarefas[0].estado, 'trabalhando', 'a que comecou agora continua')
})

test('a tarefa enterrada conta o motivo, nao some calada', () => {
  const agora = Date.now()
  const e = estadoCom([{ id: 't1', ordem: 'x', estado: 'trabalhando', em: new Date(agora - MIN).toISOString() }])
  enterrarOrfas(e, { limiteMs: 0, motivo: 'o servidor reiniciou no meio', agora })
  assert.match(e.tarefas[0].erros[0], /reiniciou/)
  assert.equal(e.tarefas[0].contada, false)
})

test('enterrar duas vezes nao ressuscita nem duplica', () => {
  const agora = Date.now()
  const e = estadoCom([{ id: 't1', ordem: 'x', estado: 'trabalhando', em: new Date(agora - MIN).toISOString() }])
  enterrarOrfas(e, { limiteMs: 0, agora })
  const segunda = enterrarOrfas(e, { limiteMs: 0, agora })
  assert.equal(segunda.length, 0)
  assert.equal(tarefasParaContar(e).length, 1)
})

test('sem tarefa nenhuma nao quebra', () => {
  assert.deepEqual(tarefasEmAndamento({}), [])
  assert.deepEqual(enterrarOrfas({}, { limiteMs: 0 }), [])
})

// ---------------------------------------------------------------------------
// A PREVISAO DE TEMPO
// ---------------------------------------------------------------------------
//
// "Seria interessante ele saber uma projecao de quanto tempo leva." — Paulo,
// 18/09/2026. A previsao sai do que ele MESMO levou, nunca de chute.

import { fecharTarefa, minutosTipicos } from './estado.js'

test('sem historico ele nao promete prazo nenhum', () => {
  // Prazo inventado e estourado toda vez destroi a confianca mais rapido que
  // nenhum prazo.
  assert.equal(minutosTipicos({}, 'trabalho'), null)
  assert.equal(minutosTipicos({ duracoes: { trabalho: [60000] } }, 'trabalho'), null)
})

test('a previsao sai do que ele levou de verdade', () => {
  const e = { duracoes: { trabalho: [120000, 180000, 240000] } }
  assert.equal(minutosTipicos(e, 'trabalho'), 3)
})

test('uma tarefa que estourou nao estraga a previsao', () => {
  // MEDIANA e nao media: um estouro de 10 minutos puxaria a media e faria ele
  // prometer mal para sempre.
  const e = { duracoes: { trabalho: [120000, 120000, 120000, 600000] } }
  assert.equal(minutosTipicos(e, 'trabalho'), 2)
})

test('trabalho e analise tem previsoes separadas', () => {
  const e = { duracoes: { trabalho: [300000, 300000], analise: [60000, 60000] } }
  assert.equal(minutosTipicos(e, 'trabalho'), 5)
  assert.equal(minutosTipicos(e, 'analise'), 1)
})

test('fechar a tarefa guarda quanto ela levou', () => {
  const inicio = Date.now()
  const e = {
    tarefas: [
      { id: 't1', tipo: 'trabalho', estado: 'trabalhando', em: new Date(inicio).toISOString() },
    ],
  }
  fecharTarefa(e, 't1', { ok: true, link: 'x' }, inicio + 4 * 60 * 1000)
  assert.equal(e.tarefas[0].levouMs, 4 * 60 * 1000)
  assert.deepEqual(e.duracoes.trabalho, [4 * 60 * 1000])
})

// ---------------------------------------------------------------------------
// O CADERNO E A MEMORIA DO QUE JA FOI FEITO
// ---------------------------------------------------------------------------
//
// Paulo, 18/09/2026: *"voce terminou a conversa com ele, volta daqui a uns
// tempinhos, e ele esqueceu totalmente"* e *"ele diz: eita, foi mesmo,
// esqueci"*.
//
// Dois esquecimentos diferentes, dois consertos diferentes.

import { anotarNoCaderno, lerCaderno, tarefasRecentes } from './estado.js'

test('contar uma vez nao apaga o que aconteceu', () => {
  // Era ESTE o "eita, esqueci": assim que o aviso saia pela boca, a tarefa era
  // marcada como contada e SUMIA do que o Zeus enxerga. Ele perguntava meia
  // hora depois e o Zeus, honesto, dizia que nao tinha registro.
  const agora = Date.now()
  const e = {
    tarefas: [
      {
        id: 't1',
        ordem: 'muda a cor do botao',
        estado: 'pronta',
        ok: true,
        contada: true,
        link: 'https://x',
        em: new Date(agora - 40 * 60 * 1000).toISOString(),
        fimEm: new Date(agora - 30 * 60 * 1000).toISOString(),
      },
    ],
  }
  const recentes = tarefasRecentes(e, 12, agora)
  assert.equal(recentes.length, 1, 'ja contada continua sendo lembrada')
  assert.equal(recentes[0].link, 'https://x')
})

test('o que terminou ontem nao polui a memoria de hoje', () => {
  const agora = Date.now()
  const e = {
    tarefas: [
      { id: 'velha', estado: 'pronta', ok: true, em: '2020-01-01T00:00:00.000Z', fimEm: '2020-01-01T00:10:00.000Z' },
    ],
  }
  assert.equal(tarefasRecentes(e, 12, agora).length, 0)
})

test('tarefa em andamento nao entra na memoria do que ja foi feito', () => {
  const agora = Date.now()
  const e = { tarefas: [{ id: 't1', estado: 'trabalhando', em: new Date(agora).toISOString() }] }
  assert.equal(tarefasRecentes(e, 12, agora).length, 0)
})

test('o caderno guarda ordem permanente e nao duplica', () => {
  // Ele viaja em TODA chamada: cada linha e paga para sempre. Duplicata aqui e
  // custo eterno.
  const e = {}
  anotarNoCaderno(e, 'De agora em diante use verde nos botoes')
  anotarNoCaderno(e, 'de agora em diante USE VERDE nos botoes')
  assert.equal(lerCaderno(e).length, 1)
  anotarNoCaderno(e, 'Nunca mexa no rodape sem me perguntar')
  assert.equal(lerCaderno(e).length, 2)
})

test('o caderno ignora anotacao vazia', () => {
  const e = {}
  anotarNoCaderno(e, '')
  anotarNoCaderno(e, '   ')
  anotarNoCaderno(e, null)
  assert.deepEqual(lerCaderno(e), [])
})
