import test from 'node:test'
import assert from 'node:assert/strict'
import { avaliar } from './vigia.js'

const AGORA = 1_000_000_000_000
const TUDO_BEM = { memoriaLivreMb: 800, vozDePe: true, usadasHoje: 5, limiteDia: 200, prsParados: [] }

test('com tudo em ordem, ele fica calado', () => {
  // A falha mais provavel deste arquivo e o excesso, nao a falta.
  assert.equal(avaliar(TUDO_BEM, {}, AGORA), null)
  assert.equal(avaliar({}, {}, AGORA), null)
  assert.equal(avaliar(null, {}, AGORA), null)
})

test('a voz caida vem primeiro — e a unica que ele nao consegue contornar', () => {
  const r = avaliar({ ...TUDO_BEM, vozDePe: false, memoriaLivreMb: 10 }, {}, AGORA)
  assert.equal(r.chave, 'voz_caiu')
  assert.match(r.fala, /^Paulo,/)
})

test('memoria apertando vira chamado', () => {
  // Ja aconteceu nesta VPS: sem memoria o sistema mata programas, e a voz e
  // o primeiro a morrer.
  const r = avaliar({ ...TUDO_BEM, memoriaLivreMb: 90 }, {}, AGORA)
  assert.equal(r.chave, 'memoria')
})

test('Pull Request parado ha horas vira chamado', () => {
  const r = avaliar(
    { ...TUDO_BEM, prsParados: [{ repo: 'moviki-app', titulo: 'x', horas: 9 }] },
    {},
    AGORA
  )
  assert.equal(r.chave, 'prs_parados')
  assert.match(r.fala, /moviki-app/)
})

test('Pull Request recem-aberto NAO vira chamado', () => {
  // Avisar do que ele acabou de receber seria falar por falar.
  const r = avaliar(
    { ...TUDO_BEM, prsParados: [{ repo: 'moviki', titulo: 'x', horas: 1 }] },
    {},
    AGORA
  )
  assert.equal(r, null)
})

test('varios parados viram UMA frase, nao uma por PR', () => {
  const r = avaliar(
    {
      ...TUDO_BEM,
      prsParados: [
        { repo: 'moviki', titulo: 'a', horas: 8 },
        { repo: 'moviki-app', titulo: 'b', horas: 30 },
      ],
    },
    {},
    AGORA
  )
  assert.match(r.fala, /2 Pull Requests/)
})

test('o teto do dia chegando e avisado ANTES de ele emudecer', () => {
  // Emudecer sem avisar deixaria o Paulo achando que quebrou.
  const r = avaliar({ ...TUDO_BEM, usadasHoje: 170, limiteDia: 200 }, {}, AGORA)
  assert.equal(r.chave, 'teto_perto')
})

test('o mesmo assunto nao se repete', () => {
  // Repetir "tem Pull Request esperando" de doze em doze segundos seria
  // insuportavel em dois minutos.
  const fatos = { ...TUDO_BEM, memoriaLivreMb: 90 }
  const jaFalados = { memoria: AGORA - 60_000 }
  assert.equal(avaliar(fatos, jaFalados, AGORA), null)
})

test('depois de horas, o mesmo assunto volta a valer', () => {
  const fatos = { ...TUDO_BEM, memoriaLivreMb: 90 }
  const jaFalados = { memoria: AGORA - 7 * 60 * 60 * 1000 }
  assert.equal(avaliar(fatos, jaFalados, AGORA).chave, 'memoria')
})

test('tres problemas juntos nao viram tres frases seguidas', () => {
  // O descanso vale para QUALQUER assunto: ele conta um e espera.
  const fatos = {
    memoriaLivreMb: 50,
    vozDePe: false,
    usadasHoje: 199,
    limiteDia: 200,
    prsParados: [{ repo: 'moviki', titulo: 'a', horas: 40 }],
  }
  const primeiro = avaliar(fatos, {}, AGORA)
  assert.ok(primeiro)

  const jaFalados = { [primeiro.chave]: AGORA }
  assert.equal(avaliar(fatos, jaFalados, AGORA + 60_000), null, 'falou de novo cedo demais')
})

test('toda fala comeca chamando ele pelo nome', () => {
  // E o que separa um aviso de um resmungo de sistema.
  const casos = [
    { ...TUDO_BEM, vozDePe: false },
    { ...TUDO_BEM, memoriaLivreMb: 10 },
    { ...TUDO_BEM, prsParados: [{ repo: 'moviki', titulo: 'a', horas: 40 }] },
    { ...TUDO_BEM, usadasHoje: 190, limiteDia: 200 },
  ]
  for (const fatos of casos) {
    assert.match(avaliar(fatos, {}, AGORA).fala, /^Paulo,/)
  }
})
