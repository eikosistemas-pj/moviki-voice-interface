import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

// O espelho de mentira precisa existir ANTES do modulo ser importado: o
// caminho e lido uma vez, quando o arquivo carrega.
const RAIZ = await fs.mkdtemp(path.join(os.tmpdir(), 'zeus-'))
process.env.ZEUS_ESPELHO = RAIZ

const REPO = 'moviki-app'
const GRANDE = [
  '<html>',
  ...Array.from({ length: 8000 }, (_, i) => `  <div class="linha-${i}">enchimento</div>`),
  '  <button style="background: #1f6feb">Entrar no painel</button>',
  ...Array.from({ length: 8000 }, (_, i) => `  <div class="fim-${i}">enchimento</div>`),
  '</html>',
].join('\n')

await fs.mkdir(path.join(RAIZ, REPO, 'firebase'), { recursive: true })
await fs.writeFile(path.join(RAIZ, REPO, 'index.html'), GRANDE)
await fs.writeFile(path.join(RAIZ, REPO, 'firebase', 'firestore.rules'), 'segredo do cofre')

const { buscar, ler } = await import('./trabalho.js')

test('acha o botao num arquivo enorme, com o numero da linha', async () => {
  // Este e o teste que existe por causa dos dez minutos: o arquivo real do
  // painel tem meio milhao de caracteres, e carregar ele inteiro era o que
  // travava o Zeus.
  const r = await buscar(REPO, 'background: #1f6feb')
  assert.match(r, /index\.html:8002/)
  assert.match(r, /Entrar no painel/)
})

test('a busca NAO alcanca o que ele nao pode alterar', async () => {
  // Ler segredo nao seria alteracao — seria vazamento.
  const r = await buscar(REPO, 'segredo do cofre')
  assert.match(r, /nao achei/)
})

test('arquivo grande sem janela vem com o comeco, nao com um nao', async () => {
  // ISTO MUDOU EM 18/09/2026, E A MUDANCA TEM DONO.
  //
  // Antes, arquivo grande sem linha devolvia SO o recado "grande demais, use
  // buscar". Do lado do Zeus isso chega como leitura que nao volta: ele pediu
  // para ler e recebeu uma recusa. O Paulo ouviu ele dizendo exatamente isso,
  // que "a leitura nao volta".
  //
  // Agora vem o recado E o comeco do arquivo — que tem titulo, cabecalho e
  // estrutura, quase sempre o bastante para ele se localizar.
  const r = await ler(REPO, 'index.html')
  assert.match(r, /grande demais/, 'tem que continuar avisando que nao veio inteiro')
  assert.match(r, /buscar/, 'e dizendo como pegar outro trecho')
  assert.match(r, /^1: /m, 'e o comeco do arquivo tem que vir junto')

  // Mas continua sendo uma AMOSTRA. Se vier o arquivo inteiro, volta o
  // problema dos dez minutos contra a parede.
  const numeradas = r.split('\n').filter((l) => /^\d+: /.test(l))
  assert.ok(numeradas.length <= 120, `veio linha demais: ${numeradas.length}`)
  assert.ok(numeradas.length > 50, 'veio pouco demais para ele se localizar')
})

test('com a linha, vem so a janela em volta — numerada', async () => {
  const r = await ler(REPO, 'index.html', 8002, 3)
  assert.match(r, /^8002:.*<button/m)
  assert.equal(r.split('\n').length, 3)
})

test('nao le fora da pasta do projeto', async () => {
  const r = await ler(REPO, '../../etc/passwd')
  assert.match(r, /nao posso ler|sai da pasta/)
})

test('termo curto demais nao vira varredura no repositorio inteiro', async () => {
  const r = await buscar(REPO, 'a')
  assert.match(r, /texto maior/)
})
