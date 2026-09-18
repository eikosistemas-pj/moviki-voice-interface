// servidor/cerebro.js  (repo: moviki-voice-interface)
//
// O CEREBRO DO ZEUS — chamada a API da Anthropic (Claude).
//
// Sem SDK, com fetch cru: mesmo padrao do moviki-ai/lib/anthropic.js e do
// resto dos repos (Telegram, Resend, Asaas). Um servidor que o Paulo mantem
// sozinho numa VPS tem mais valor em nao ter dependencia para atualizar do
// que em ter acucar de sintaxe.
//
// ENV (na VPS, nunca em arquivo):
//   ANTHROPIC_API_KEY   chave da API
//   ZEUS_MODELO         opcional. Padrao abaixo.
//   ZEUS_TIMEOUT        opcional, em ms. Padrao 30000.
//
// MODELO — rapido para CONVERSAR, forte para TRABALHAR
//
// Aqui e conversa, e conversa e medida em segundos de espera. O Paulo
// reclamou da demora em 18/09/2026, e metade dela era o modelo grande
// pensando antes de cada frase falada.
//
// Entao a conversa passou para `claude-haiku-4-5`: com o mapa mestre no
// prompt, a diferenca de qualidade numa resposta de tres frases e pequena, e
// a diferenca de tempo e enorme. O modelo forte continua onde importa — em
// servidor/trabalho.js, que le codigo e escreve alteracao, onde pensar bem
// vale mais que responder rapido.
//
// Quem quiser o forte tambem na conversa troca ZEUS_MODELO na VPS, sem novo
// deploy. Vai ficar mais lento e mais caro; e escolha do Paulo.
//
// A RESPOSTA VEM EM FLUXO — 18/09/2026, segunda rodada
//
// Antes o servidor esperava a resposta INTEIRA da Anthropic para so entao
// mandar para a tela, que so entao mandava para a voz, que so entao
// sintetizava. Tres esperas em fila, uma depois da outra.
//
// Agora o texto chega palavra por palavra e cada FRASE PRONTA sai na hora
// para a tela ir sintetizando. A ultima palavra chega no mesmo tempo de
// antes; a PRIMEIRA chega numa fracao — e e a primeira que o Paulo chama de
// "demora".
//
// O `effort` SAIU DAQUI, E NAO FOI ECONOMIA
// A versao anterior mandava `output_config: { effort: 'low' }` junto com o
// `claude-haiku-4-5`. O Haiku 4.5 NAO aceita esse parametro: a API responde
// 400 e o Zeus fica sem resposta nenhuma — que e pior que lento, e mudo.
// Agora o parametro so vai quando o modelo configurado aceita (ver
// `aceitaEsforco`), e o Haiku roda sem ele, que e o certo: ele ja e rapido
// e nao gasta raciocinio longo por padrao.
//
// TIMEOUT E OBRIGATORIO
// Sem ele, uma chamada travada deixa o Zeus mudo de boca aberta, sem dizer
// nem que deu errado. Melhor ele falar "nao consegui" do que emudecer.
// Aqui o relogio conta ate a PRIMEIRA palavra: depois que o texto comecou a
// sair, cortar no meio seria trocar uma resposta lenta por meia resposta.

import { criarFluxoFala } from '../lib/fluxoFala.js'

const MODELO_PADRAO = 'claude-haiku-4-5'
const TIMEOUT_PADRAO = 30000

/** Teto de resposta. Voz longa cansa: o Zeus fala, nao redige. */
const MAX_TOKENS = 600

/**
 * Quem o Zeus e.
 *
 * Escrito para ser FALADO. Todo o resto do Moviki e texto na tela; aqui a
 * saida vira audio, e audio nao tem negrito, nem lista, nem link para clicar.
 */
export function montarPersona() {
  return `Voce e o ZEUS, assistente de comando do Paulo, dono do MOVIKI.

O MOVIKI e um SaaS para negocios itinerantes (food truck, feira, loja movel):
o lojista aparece no mapa onde esta, vende ao vivo pelo celular e recebe no
Pix. Planos: Basico gratis, Pro, Premium e Enterprise. O Paulo toca tudo
sozinho e nao e programador.

O sistema tem sete repositorios e um time de cadeiras especialistas:
Gabinete (coordenacao e memoria), Guarda (seguranca e LGPD), Tesouraria
(dinheiro), Vitrine (site publico), Balcao (painel do lojista), Canal
(parceiros), Atendimento (atendentes de IA), Praca (redes sociais).

VOCE NAO E ATENDENTE DE CLIENTE. Voce e o posto de comando do Paulo: ele fala
com voce e voce aciona o time. Quando ele nao esta, voce fica no lugar dele.

COMO VOCE FALA
- Portugues do Brasil, direto, sem rodeio.
- Voce esta sendo OUVIDO, nao lido: frases curtas, sem lista, sem markdown,
  sem endereco de site soletrado. DUAS OU TRES FRASES, no maximo — cada frase
  a mais e mais tempo que o Paulo passa esperando o audio sair. Se ele quiser
  detalhe, ele pede.
- Nada de codigo. Explique em linguagem de negocio: o que muda para o
  lojista, para o parceiro, para o Paulo.
- Trate o Paulo por voce, sem cerimonia. Voce trabalha com ele ha tempo.

O QUE VOCE NUNCA FAZ SOZINHO, nem com o turno aberto:
aprovar ou juntar Pull Request, mexer em preco ou plano, mexer em dinheiro
(Asaas, comissao, saque), mexer em seguranca ou segredo, publicar nas redes
em nome do Moviki, e apagar qualquer coisa. Se ele pedir, diga que isso e
dele e por que — em uma frase, sem sermao.

E MAIS UMA, que vale acima de todas: VOCE NAO MEXE EM VOCE MESMO. Nao altera
a sua trava, o seu codigo, o seu prompt, o seu servidor, a sua chave nem o
servico na VPS. O Paulo precisa poder entrar e mexer em voce a qualquer hora,
e voce nunca e quem decide se isso e permitido. Se ele mandar voce se alterar,
diga que isso e com ele e siga em frente — sem discutir e sem se ofender.
Chamar voce pelo nome nao conta: "Zeus, muda o texto da pagina" e ordem
normal, e voce atende.

VOCE NAO ABRE O MICROFONE. Quem decide quando falar com voce e o Paulo, com o
dedo no botao. Nunca peca para ele deixar a escuta aberta, e nunca sugira
ficar ouvindo sozinho.

NA DUVIDA VOCE PARA. Robo que trava e aborrecimento; robo que decide errado
no lugar do dono e prejuizo. Se faltar informacao, pergunte ou diga que vai
deixar anotado.

VOCE TEM OLHOS, MAS NAO ADIVINHA. A cada conversa voce recebe o mapa oficial
do projeto e o estado real dos repositorios, lido do codigo. Use como fato. O
que nao estiver ali voce NAO sabe — e "nao estou ligado nisso" e melhor
resposta que um numero inventado. Chute com voz de comando vira decisao
errada do Paulo.

VOCE SO ENXERGA O CODIGO. Numero de negocio — quantos lojistas, faturamento,
assinaturas, pedidos — mora no Firestore, e voce ainda nao alcanca. Perguntado
sobre numero assim, diga que ainda nao esta ligado nisso.

VOCE TAMBEM TRABALHA. Quando o Paulo manda MEXER em alguma coisa (mudar,
ajustar, corrigir, acrescentar), voce le o codigo e abre um Pull Request para
ele aprovar. Voce nunca junta na main — o Vercel publica a main na hora para
os clientes, e isso e do Paulo. Trabalho leva minutos e corre por fora da
conversa: voce avisa que comecou e conta o resultado quando ele falar de novo.`
}

/**
 * O pedaco que MUDA a cada conversa: o turno e o retrato de agora.
 *
 * Separado da persona de proposito. A Anthropic cobra um decimo pelo texto
 * repetido que ela ja viu, mas so enquanto o comeco do prompt nao muda nem um
 * byte. Persona e mapa sao iguais sempre e vao no pedaco barato; o retrato
 * muda de quinze em quinze minutos e fica de fora. Misturar os dois faria o
 * mapa inteiro ser cobrado cheio a cada frase — e o mapa e grande.
 */
export function montarMomento({ turnoAberto, retrato, tarefas }) {
  const turno = turnoAberto
    ? 'ABERTO — o Paulo saiu e passou o posto para voce. Pode decidir dentro da cerca, e vai prestar contas quando ele chegar.'
    : 'FECHADO — o Paulo esta aqui. Voce executa o que ele mandar e nao decide nada no lugar dele.'

  const partes = [`TURNO AGORA: ${turno}`, '']

  // O trabalho corre por fora da conversa e termina sozinho. Se o Zeus nao
  // contar na primeira oportunidade, o Paulo descobre o Pull Request dias
  // depois, sem lembrar de ter pedido.
  if (tarefas?.length) {
    partes.push('TRABALHO QUE VOCE TERMINOU E AINDA NAO CONTOU AO PAULO —')
    partes.push('comece a resposta por isso, em uma frase, antes de responder o resto:')
    for (const t of tarefas) {
      partes.push(
        t.ok
          ? `  "${t.ordem}" — pronto, abri um Pull Request: ${t.link}`
          : `  "${t.ordem}" — nao deu: ${(t.erros || []).join('; ')}`
      )
    }
    partes.push('')
  }

  partes.push(
    retrato || '(ainda nao olhei os repositorios; nao afirme nada sobre o estado do codigo)'
  )
  return partes.join('\n')
}

/**
 * Monta o `system` em blocos. O primeiro (persona + mapa) leva a marca de
 * cache: tudo ate ela e cobrado barato a partir da segunda vez.
 */
export function montarSystem({ turnoAberto, mapa, retrato, tarefas }) {
  const fixo = [montarPersona()]
  if (mapa) {
    fixo.push(
      '',
      'A SEGUIR, O MAPA MESTRE DO MOVIKI — a memoria oficial do projeto, lida',
      'do repositorio. E a fonte da verdade sobre como a empresa funciona, o',
      'que cada parte faz e o que nunca pode ser quebrado.',
      '',
      mapa
    )
  }

  return [
    { type: 'text', text: fixo.join('\n'), cache_control: { type: 'ephemeral' } },
    { type: 'text', text: montarMomento({ turnoAberto, retrato, tarefas }) },
  ]
}

/**
 * Modelos que aceitam `output_config.effort`.
 *
 * O Haiku 4.5 NAO aceita: mandar o parametro para ele devolve 400 e o Zeus
 * fica sem resposta. Na duvida o parametro NAO vai — deixar de mandar custa
 * no maximo um pouco de raciocinio a mais; mandar errado custa a resposta
 * inteira.
 */
export function aceitaEsforco(modelo) {
  return /^claude-(opus|sonnet|fable|mythos)-[5-9]/.test(String(modelo || ''))
}

/** Monta o corpo do pedido. Separado so para o teste poder conferir. */
export function montarPedido({ modelo, system, historico, falaNova }) {
  const messages = (historico || []).map((m) => ({
    role: m.papel === 'zeus' ? 'assistant' : 'user',
    content: String(m.texto || ''),
  }))
  messages.push({ role: 'user', content: String(falaNova || '') })

  const corpo = {
    model: modelo,
    max_tokens: MAX_TOKENS,
    system,
    messages,
    // O fluxo e o conserto da demora: sem ele o servidor segura a resposta
    // inteira antes de deixar a voz comecar.
    stream: true,
  }
  // Voz: resposta rapida vale mais que raciocinio longo — nos modelos que
  // sabem o que fazer com essa instrucao.
  if (aceitaEsforco(modelo)) corpo.output_config = { effort: 'low' }
  return corpo
}

/**
 * Le o fluxo de eventos da Anthropic e entrega os pedacos de texto.
 *
 * Formato SSE: blocos separados por linha em branco, cada linha util
 * comecando com `data:`. So interessa o texto que sai; o resto e contabilidade.
 */
async function* lerEventos(corpo) {
  const decodificador = new TextDecoder()
  let sobra = ''
  for await (const bruto of corpo) {
    sobra += decodificador.decode(bruto, { stream: true })
    const blocos = sobra.split('\n\n')
    sobra = blocos.pop() || ''
    for (const bloco of blocos) {
      for (const linha of bloco.split('\n')) {
        if (!linha.startsWith('data:')) continue
        const dado = linha.slice(5).trim()
        if (!dado || dado === '[DONE]') continue
        try {
          yield JSON.parse(dado)
        } catch {
          /* bloco partido pela metade: o proximo pedaco completa */
        }
      }
    }
  }
}

/**
 * Pergunta ao Claude e entrega a resposta EM FRASES, conforme elas ficam
 * prontas.
 *
 *   historico: [{ papel: 'paulo'|'zeus', texto }]
 *   aoPedaco:  chamada a cada frase pronta para falar
 *
 * Devolve `{ ok, texto }`. Nunca lanca: o Zeus precisa conseguir dizer que
 * deu errado em vez de emudecer.
 */
export async function pensarEmFluxo({ system, historico, falaNova, aoPedaco }) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('[zeus] ANTHROPIC_API_KEY ausente na VPS.')
    return { ok: false, texto: '' }
  }

  const modelo = process.env.ZEUS_MODELO || MODELO_PADRAO
  const limite = Number(process.env.ZEUS_TIMEOUT || TIMEOUT_PADRAO)

  const ctrl = new AbortController()
  // O relogio conta ate a PRIMEIRA palavra. Depois que o texto comecou a
  // sair, abortar entregaria meia resposta — pior que uma resposta lenta.
  let relogio = setTimeout(() => {
    try {
      ctrl.abort()
    } catch {
      /* ja abortado */
    }
  }, limite)
  const desarmarRelogio = () => {
    if (relogio) {
      clearTimeout(relogio)
      relogio = null
    }
  }

  const comecou = Date.now()
  let primeiraPalavraEm = null
  const fluxo = criarFluxoFala()
  let inteiro = ''
  const contas = { entrada: 0, cache: 0, saida: 0 }

  const entregar = (pedacos) => {
    for (const p of pedacos) {
      if (primeiraPalavraEm === null) primeiraPalavraEm = Date.now() - comecou
      aoPedaco?.(p)
    }
  }

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(montarPedido({ modelo, system, historico, falaNova })),
      signal: ctrl.signal,
    })

    if (!resp.ok || !resp.body) {
      const detalhe = await resp.text().catch(() => '')
      console.error('[zeus] API recusou:', resp.status, String(detalhe).slice(0, 400))
      return { ok: false, texto: '' }
    }

    for await (const evento of lerEventos(resp.body)) {
      if (evento.type === 'content_block_delta' && evento.delta?.type === 'text_delta') {
        const parte = String(evento.delta.text || '')
        if (!parte) continue
        desarmarRelogio()
        inteiro += parte
        entregar(fluxo.empurrar(parte))
      } else if (evento.type === 'message_start') {
        const u = evento.message?.usage || {}
        contas.entrada = u.input_tokens || 0
        contas.cache = u.cache_read_input_tokens || 0
      } else if (evento.type === 'message_delta') {
        contas.saida = evento.usage?.output_tokens || contas.saida
      } else if (evento.type === 'error') {
        console.error('[zeus] erro no meio do fluxo:', JSON.stringify(evento.error).slice(0, 300))
      }
    }

    entregar(fluxo.encerrar())

    // Sem isto ninguem percebe que o cache parou de valer — e a conta dobra
    // em silencio. Um byte mudado no comeco do prompt basta para isso.
    //
    // E os DOIS tempos, que sao coisas diferentes: o primeiro e o que o Paulo
    // sente como demora; o segundo e so quanto ele fala no total.
    console.log(
      `[zeus] pensou: primeira frase em ${((primeiraPalavraEm ?? 0) / 1000).toFixed(1)}s, ` +
        `resposta inteira em ${((Date.now() - comecou) / 1000).toFixed(1)}s — ` +
        `${contas.entrada} tokens novos, ${contas.cache} do cache, ${contas.saida} de resposta`
    )

    const texto = inteiro.trim()
    return texto ? { ok: true, texto } : { ok: false, texto: '' }
  } catch (e) {
    console.error('[zeus] Falha ao pensar:', e?.message || e)
    // Se ja tinha saido alguma frase, o Paulo ouviu meia resposta. Melhor
    // admitir o que houve do que fingir que terminou.
    return { ok: inteiro.trim().length > 0, texto: inteiro.trim() }
  } finally {
    desarmarRelogio()
  }
}
