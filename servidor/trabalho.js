// servidor/trabalho.js  (repo: moviki-voice-interface)
//
// O ZEUS TRABALHANDO — de ordem falada a proposta de alteracao.
//
// COMO FUNCIONA
// O cerebro recebe a ordem e ganha DUAS ferramentas de leitura: listar a
// pasta e ler um arquivo. Com elas ele se orienta no codigo. Quando entende o
// que precisa mudar, chama `propor` com os arquivos ja escritos. A proposta
// passa pela conferencia e so entao vai para a oficina virar Pull Request.
//
// AS TRES CERCAS, E POR QUE SAO TRES
//
//   1. Ele NAO TEM ferramenta de escrever, nem de rodar comando. As unicas
//      coisas que sabe fazer aqui sao ler e propor. O que nao existe nao pode
//      ser usado torto.
//   2. A leitura respeita `podeMexer`: ele nao le o que nao pode alterar.
//      Ler o arquivo de segredos nao seria alteracao — seria vazamento.
//   3. Toda proposta passa pela conferencia ANTES da oficina, mesmo que a
//      instrucao ja mande nao pedir nada proibido. Instrucao e pedido; a
//      conferencia e trava.
//
// E TEM TETO DE IDAS E VINDAS
// Cerebro perdido no codigo fica lendo arquivo para sempre, e cada ida e uma
// chamada paga. Depois do teto ele para e diz que nao deu.

import fs from 'node:fs/promises'
import path from 'node:path'
import { podeMexer, REPOS_PERMITIDOS } from './maos.js'
import { nomearRamo, validar } from './proposta.js'

/** Onde ele LE para trabalhar: o espelho, que e so leitura. */
const ESPELHO = process.env.ZEUS_ESPELHO || '/root/eikosistemas'

/** Quantas idas e vindas antes de desistir. */
const MAX_VOLTAS = Number(process.env.ZEUS_MAX_VOLTAS || 12)

// Aqui NAO se economiza. Conversar rapido e uma coisa; ler codigo e escrever
// alteracao que o Paulo vai aprovar e outra. O modelo forte fica onde o erro
// custa caro — e trabalho corre por fora da conversa, entao o tempo dele nao
// deixa ninguem esperando na frente da tela.
const MODELO = process.env.ZEUS_MODELO_TRABALHO || 'claude-opus-5'

const FERRAMENTAS = [
  {
    name: 'listar',
    description:
      'Lista os arquivos de uma pasta do repositorio. Use para se orientar antes de ler.',
    input_schema: {
      type: 'object',
      properties: {
        pasta: { type: 'string', description: 'caminho da pasta; vazio para a raiz' },
      },
      required: [],
    },
  },
  {
    name: 'ler',
    description: 'Le um arquivo do repositorio.',
    input_schema: {
      type: 'object',
      properties: { caminho: { type: 'string' } },
      required: ['caminho'],
    },
  },
  {
    name: 'propor',
    description:
      'Entrega a alteracao pronta. Escreva o conteudo COMPLETO de cada arquivo alterado, nao um trecho.',
    input_schema: {
      type: 'object',
      properties: {
        titulo: {
          type: 'string',
          description: 'uma linha, em portugues, explicando a alteracao',
        },
        resumo: { type: 'string', description: 'o que muda, em linguagem de negocio' },
        arquivos: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              caminho: { type: 'string' },
              conteudo: { type: 'string' },
            },
            required: ['caminho', 'conteudo'],
          },
        },
      },
      required: ['titulo', 'resumo', 'arquivos'],
    },
  },
]

function instrucao(repo) {
  return `Voce e o ZEUS trabalhando no repositorio ${repo} do MOVIKI, a pedido do Paulo.

COMO TRABALHAR
Use "listar" e "ler" para entender o codigo ANTES de propor. Nunca proponha
alteracao em arquivo que voce nao leu — reescrever por cima do que voce nao
viu apaga o trabalho de outra pessoa.

Ao propor, mande o conteudo COMPLETO do arquivo, do comeco ao fim, ja com a
sua alteracao aplicada. Nao mande trecho, nao mande diff, nao escreva "o resto
do arquivo continua igual".

Siga o estilo do codigo que voce leu: mesma lingua nos comentarios, mesma
indentacao, mesmos nomes. Codigo que destoa e codigo que denuncia pressa.

O QUE VOCE NAO FAZ
Nao mexe em regra de seguranca, rotina automatica, segredo, preco nem no mapa
mestre. Nao mexe no robo do dinheiro. Se a ordem exigir isso, nao proponha
nada: explique numa frase que aquilo e do Paulo.

Faca o MINIMO que resolve o pedido. Voce nao esta aqui para melhorar o que
ninguem pediu — alteracao extra e revisao que o Paulo nao pediu e nao vai ler.`
}

/** Le com as mesmas regras de quem escreve: nao le o que nao pode alterar. */
async function lerDoEspelho(repo, caminho) {
  const veredito = podeMexer(repo, caminho)
  if (!veredito.permitido) return `(nao posso ler: ${veredito.motivo})`
  try {
    const texto = await fs.readFile(path.join(ESPELHO, repo, caminho), 'utf8')
    return texto.length > 120_000 ? `${texto.slice(0, 120_000)}\n(cortado)` : texto
  } catch {
    return '(esse arquivo nao existe)'
  }
}

async function listarPasta(repo, pasta = '') {
  if (pasta.includes('..') || pasta.startsWith('/')) return '(caminho invalido)'
  try {
    const itens = await fs.readdir(path.join(ESPELHO, repo, pasta), {
      withFileTypes: true,
    })
    return itens
      .filter((i) => i.name !== '.git' && i.name !== 'node_modules')
      .map((i) => (i.isDirectory() ? `${i.name}/` : i.name))
      .join('\n')
  } catch {
    return '(essa pasta nao existe)'
  }
}

/** Recebe a ordem falada e devolve a proposta pronta, ou o motivo de nao dar. */
export async function montarProposta({ repo, ordem }) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { ok: false, erros: ['sem chave da Anthropic'] }
  if (!REPOS_PERMITIDOS.includes(repo)) {
    return { ok: false, erros: ['esse repositorio nao e meu'] }
  }

  const messages = [{ role: 'user', content: `Ordem do Paulo: ${ordem}` }]

  for (let volta = 0; volta < MAX_VOLTAS; volta += 1) {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODELO,
        max_tokens: 16000,
        system: instrucao(repo),
        tools: FERRAMENTAS,
        messages,
      }),
    })

    if (!resp.ok) {
      const detalhe = await resp.text().catch(() => '')
      return { ok: false, erros: [`a IA recusou: ${detalhe.slice(0, 150)}`] }
    }

    const dados = await resp.json()
    messages.push({ role: 'assistant', content: dados.content })

    const chamadas = (dados.content || []).filter((b) => b.type === 'tool_use')
    if (chamadas.length === 0) {
      const texto = (dados.content || []).find((b) => b.type === 'text')?.text
      return { ok: false, erros: [texto || 'nao consegui montar a alteracao'] }
    }

    const entrega = chamadas.find((c) => c.name === 'propor')
    if (entrega) {
      const proposta = {
        repo,
        ramo: nomearRamo(entrega.input?.titulo || ordem),
        titulo: entrega.input?.titulo,
        resumo: entrega.input?.resumo,
        arquivos: entrega.input?.arquivos || [],
      }
      const conferencia = validar(proposta)
      return conferencia.ok
        ? { ok: true, proposta }
        : { ok: false, erros: conferencia.erros }
    }

    // Todas as leituras da rodada voltam JUNTAS, numa mensagem so: separar
    // ensina o modelo a parar de pedir varias coisas de uma vez, e ai cada
    // arquivo vira uma ida e volta paga.
    const resultados = []
    for (const c of chamadas) {
      const saida =
        c.name === 'ler'
          ? await lerDoEspelho(repo, c.input?.caminho || '')
          : c.name === 'listar'
            ? await listarPasta(repo, c.input?.pasta || '')
            : '(nao conheco essa ferramenta)'
      resultados.push({ type: 'tool_result', tool_use_id: c.id, content: saida })
    }
    messages.push({ role: 'user', content: resultados })
  }

  return { ok: false, erros: ['me perdi no codigo e parei antes de gastar mais'] }
}
