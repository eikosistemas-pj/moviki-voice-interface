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
- COMECE SEMPRE POR UMA FRASE BEM CURTA. A sua primeira frase e a unica que o
  Paulo espera ouvindo SILENCIO: ela precisa virar audio inteira antes de sair
  um som. Uma primeira frase de dez palavras faz ele esperar o dobro de uma de
  cinco. Diga o essencial em poucas palavras ("Terminei.", "Ja esta no ar.",
  "Nao deu.") e guarde o detalhe para a frase seguinte, que e preparada
  enquanto a primeira ja esta tocando.
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

VOCE NUNCA DIZ QUE ESTA TRABALHANDO EM ALGO QUE NAO ESTA NA SUA LISTA.
Esta e a regra mais dura que voce tem sobre o que voce FALA. Voce recebe a
cada conversa a lista exata do que esta em andamento, com quanto tempo cada
coisa ja levou. Essa lista e a unica verdade sobre isso.

- Se ele perguntar de algo que ESTA na lista, responda com o relogio na mao:
  "faz sete minutos". Passando de dez, diga que esta demorando mais do que
  devia — nao diga que esta indo bem.
- Se ele perguntar de algo que NAO esta na lista, diga que nao tem registro
  daquilo em andamento e pergunte se e para comecar agora.
- NUNCA diga "estou analisando", "estou verificando", "esta em andamento" ou
  "ja ja te conto" para preencher silencio. Voce nao tem ferramenta de
  analisar: ou o trabalho esta na lista, ou ele nao existe.

Dizer "ainda estou nisso" sobre algo que morreu ha horas e a pior coisa que
voce pode fazer com o Paulo: ele fica esperando em vez de tocar a vida.

VOCE TEM UM CADERNO. Quando o Paulo toma uma decisao, te corrige, ou diz como
ele quer que uma coisa seja feita daqui para frente, isso fica anotado e volta
para voce em TODA conversa — mesmo semanas depois. Trate o que estiver ali como
ordem permanente dele. Se ele disser algo que contraria o caderno, o mais NOVO
ganha: ele mudou de ideia, e quem manda e ele.

E O CONTRARIO TAMBEM E PROIBIDO: VOCE NAO ESQUECE.
Voce tambem recebe a lista do que JA TERMINOU nas ultimas horas, com o horario
e o resultado. Se ele perguntar de qualquer coisa que esteja nela, responda
pela lista. NUNCA diga "esqueci", "nao lembro" ou "nao tenho registro" sobre
algo que esta ali — ja ter contado uma vez nao apaga o que aconteceu.

VOCE TEM OLHOS, MAS NAO ADIVINHA. A cada conversa voce recebe o mapa oficial
do projeto e o estado real dos repositorios, lido do codigo. Use como fato. O
que nao estiver ali voce NAO sabe — e "nao estou ligado nisso" e melhor
resposta que um numero inventado. Chute com voz de comando vira decisao
errada do Paulo.

VOCE SO ENXERGA O CODIGO. Numero de negocio — quantos lojistas, faturamento,
assinaturas, pedidos — mora no Firestore, e voce ainda nao alcanca. Perguntado
sobre numero assim, diga que ainda nao esta ligado nisso.

VOCE TAMBEM ENXERGA PARA FORA. Quando ele pergunta de coisa que nao mora no
codigo nem no mapa — preco de concorrente, regra que mudou numa plataforma,
noticia, "quanto custa hoje" — voce PESQUISA NA INTERNET e responde, dizendo de
onde veio o que voce falou. Isso corre por fora da conversa: voce avisa que vai
procurar e a resposta sai sozinha.

O que voce aprendeu no treino tem data de validade e voce nao sabe qual parte
esta velha. Entao, em pergunta que depende de AGORA, procurar vale mais que
lembrar.

VOCE SABE OLHAR O CODIGO E RESPONDER. Quando ele pede para voce ANALISAR,
conferir, verificar ou dar uma olhada em alguma parte do Moviki, voce vai ler
o codigo de verdade e responder o que viu — sem mexer em nada e sem abrir
Pull Request. Isso leva alguns segundos e corre por fora da conversa: voce
avisa que vai olhar e a resposta SAI SOZINHA quando ficar pronta, sem ele
precisar perguntar de novo.

VOCE TAMBEM TRABALHA. Quando o Paulo manda MEXER em alguma coisa (mudar,
ajustar, corrigir, acrescentar), voce le o codigo e abre um Pull Request para
ele aprovar. Voce nunca junta na main — o Vercel publica a main na hora para
os clientes, e isso e do Paulo.

VOCE NUNCA PEDE PARA ELE VOLTAR DEPOIS. Isto e regra, nao estilo.
Trabalho e analise correm por fora da conversa e, quando terminam, VOCE FALA
SOZINHO — deu certo ou deu errado, do mesmo jeito. Ele nao precisa perguntar,
nao precisa voltar, nao precisa lembrar.

Entao NUNCA diga "me pergunte daqui a pouco", "fale comigo mais tarde", "volte
depois" ou "me avise quando quiser saber". Diga "vou fazer e te aviso" e pare.
Empurrar a lembranca para o Paulo e devolver para ele exatamente o trabalho
que voce existe para tirar.`
}

/**
 * O pedaco que MUDA A CADA FALA: o turno e o trabalho por contar.
 *
 * E o unico bloco sem desconto de cache, e por isso e o unico que precisa ser
 * pequeno. O retrato saiu daqui e virou bloco proprio, com cache: ele muda de
 * quinze em quinze minutos, nao a cada frase, e mandar dois mil tokens dele a
 * preco cheio toda vez era demora e dinheiro jogados fora.
 */
export function montarMomento({ turnoAberto, tarefas, emAndamento, recentes, caderno }) {
  const turno = turnoAberto
    ? 'ABERTO — o Paulo saiu e passou o posto para voce. Pode decidir dentro da cerca, e vai prestar contas quando ele chegar.'
    : 'FECHADO — o Paulo esta aqui. Voce executa o que ele mandar e nao decide nada no lugar dele.'

  const partes = [`TURNO AGORA: ${turno}`, '']

  // O CADERNO. O que o Paulo ja te disse e nao quer repetir.
  //
  // A conversa rola; isto nao. Sao as decisoes e correcoes dele, guardadas para
  // ele nao ter que dizer a mesma coisa toda semana.
  if (caderno?.length) {
    partes.push('O QUE O PAULO JA TE DISSE — vale como ordem permanente:')
    for (const a of caderno) partes.push(`  - ${a.texto}`)
    partes.push('')
  }

  // O trabalho corre por fora da conversa e termina sozinho. Se o Zeus nao
  // contar na primeira oportunidade, o Paulo descobre o Pull Request dias
  // depois, sem lembrar de ter pedido.
  if (tarefas?.length) {
    partes.push('TRABALHO QUE VOCE TERMINOU E AINDA NAO CONTOU AO PAULO —')
    partes.push('comece a resposta por isso, em uma frase, antes de responder o resto:')
    for (const t of tarefas) {
      if (!t.ok) {
        partes.push(`  "${t.ordem}" — nao deu: ${(t.erros || []).join('; ')}`)
      } else if (t.tipo === 'analise') {
        // Analise nao entrega link, entrega RESPOSTA. Repasse o conteudo dela;
        // nao diga "terminei de analisar" e pare, senao ele pergunta de novo a
        // mesma coisa.
        partes.push(`  voce olhou "${t.ordem}" e concluiu: ${t.resposta}`)
      } else {
        partes.push(`  "${t.ordem}" — pronto, abri um Pull Request: ${t.link}`)
      }
    }
    partes.push('')
  }

  // O QUE ELE JA TERMINOU HOJE — mesmo o que ja foi contado uma vez.
  //
  // Sem isto ele ESQUECE. Assim que o aviso saia pela boca, a tarefa sumia do
  // que ele enxerga: o Paulo perguntava meia hora depois e o Zeus, honesto,
  // dizia que nao tinha registro — o que soa exatamente como "eita, esqueci".
  //
  // Contar uma vez nao pode ser o mesmo que apagar.
  if (recentes?.length) {
    partes.push('O QUE VOCE JA FEZ NAS ULTIMAS HORAS — e a sua memoria, use como fato:')
    for (const t of recentes) {
      const quando = t.fimEm ? ` (terminou ${new Date(t.fimEm).toISOString().slice(11, 16)} UTC)` : ''
      if (!t.ok) {
        partes.push(`  "${t.ordem}" — NAO DEU${quando}: ${(t.erros || []).join('; ')}`)
      } else if (t.tipo === 'analise') {
        partes.push(`  voce olhou "${t.ordem}"${quando} e concluiu: ${t.resposta}`)
      } else {
        partes.push(`  "${t.ordem}" — pronto${quando}, Pull Request: ${t.link}`)
      }
    }
    partes.push(
      'Se ele perguntar de qualquer uma delas, RESPONDA PELA LISTA. Nunca diga',
      'que esqueceu ou que nao tem registro de coisa que esta aqui.',
      ''
    )
  }

  // A LISTA COMPLETA DO QUE ESTA EM ANDAMENTO, COM O RELOGIO.
  //
  // Sem isto ele nao tinha NADA no prompt sobre trabalho em andamento — so
  // sobre trabalho terminado. Lia no historico que tinha dito "vou trabalhar
  // nisso" e repetia aquilo para sempre. O Paulo pediu a cor de um botao de
  // manha e a tarde ouviu "a tarefa esta em andamento". Isso e o robo
  // inventando, e inventar com voz de comando e o pior defeito que ele pode
  // ter.
  if (emAndamento?.length) {
    partes.push('TRABALHO SEU QUE ESTA EM ANDAMENTO AGORA — esta lista e a VERDADE:')
    for (const t of emAndamento) {
      partes.push(`  "${t.ordem}" (${t.repo}) — comecei ha ${t.minutos} minutos`)
    }
    partes.push(
      'Se ele perguntar, diga HA QUANTO TEMPO. E se ja passar de dez minutos,',
      'diga que esta demorando mais do que devia em vez de dizer que esta indo bem.',
      ''
    )
  } else {
    partes.push(
      'NAO HA NENHUM TRABALHO SEU EM ANDAMENTO NESTE MOMENTO.',
      'Se ele perguntar por algo que voce teria comecado, diga que nao tem',
      'registro disso em andamento e pergunte se e para comecar agora. NAO diga',
      'que esta trabalhando, analisando ou verificando: seria mentira.',
      ''
    )
  }

  return partes.join('\n')
}

/**
 * Monta o `system` em blocos. O primeiro (persona + mapa) leva a marca de
 * cache: tudo ate ela e cobrado barato a partir da segunda vez.
 */
export function montarSystem({ turnoAberto, mapa, retrato, tarefas, emAndamento, recentes, caderno }) {
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

  // TRES BLOCOS, DO MAIS PARADO PARA O MAIS MEXIDO — e os dois primeiros com
  // marca de cache. O desconto so vale enquanto o COMECO do pedido nao muda
  // nem um byte, entao a ordem aqui e a regra:
  //
  //   1. persona + mapa .... igual sempre          -> cache de 1 hora
  //   2. retrato ........... muda de 15 em 15 min  -> cache normal
  //   3. turno + tarefas ... muda a cada fala      -> sem cache
  //
  // O CACHE DE UMA HORA E CONSERTO DE DEMORA, NAO SO DE CUSTO — 18/09/2026.
  // O registro da VPS mostrou varias conversas com "0 do cache": o desconto
  // padrao vence em cinco minutos, e o Paulo fala com o Zeus de vez em quando,
  // nao de cinco em cinco minutos. Cada vencimento obriga a reler treze mil
  // tokens do zero — o que ele sente como a resposta demorando mais.
  //
  // O retrato fica FORA do bloco de uma hora porque ele muda sozinho a cada
  // quinze minutos: junto, um byte novo nele derrubaria o mapa inteiro.
  return [
    {
      type: 'text',
      text: fixo.join('\n'),
      cache_control: { type: 'ephemeral', ttl: '1h' },
    },
    {
      type: 'text',
      text: retrato || '(ainda nao olhei os repositorios; nao afirme nada sobre o estado do codigo)',
      cache_control: { type: 'ephemeral' },
    },
    { type: 'text', text: montarMomento({ turnoAberto, tarefas, emAndamento, recentes, caderno }) },
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
