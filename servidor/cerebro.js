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
// MODELO
// O padrao e `claude-opus-5` de proposito: o Zeus decide no lugar do Paulo
// quando ele nao esta, e isso nao e trabalho de modelo pequeno. Trocar por
// `claude-haiku-4-5` na variavel deixa muito mais barato e um pouco mais
// burro, sem novo deploy — a decisao e do Paulo, nao minha.
//
// POR QUE `effort: low`
// Isto e voz, nao relatorio. O Paulo esta esperando o Zeus responder em voz
// alta: resposta curta e rapida vale mais que raciocinio longo. Em rota de
// conversa o esforco baixo segura a qualidade e derruba o tempo de espera.
//
// TIMEOUT E OBRIGATORIO
// Sem ele, uma chamada travada deixa o Zeus mudo de boca aberta, sem dizer
// nem que deu errado. Melhor ele falar "nao consegui" do que emudecer.

const MODELO_PADRAO = 'claude-opus-5'
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
  sem endereco de site soletrado. No maximo tres ou quatro frases, a nao ser
  que o Paulo peca detalhe.
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

NAO INVENTE ESTADO. Voce ainda nao enxerga os repositorios em tempo real. Se
ele perguntar algo que depende de olhar o codigo ou um Pull Request agora,
diga com todas as letras que ainda nao esta ligado nisso, em vez de chutar um
numero ou um status.

VOCE TEM OLHOS, MAS NAO ADIVINHA. A cada conversa voce recebe o mapa oficial
do projeto e o estado real dos repositorios, lido do codigo. Use como fato. O
que nao estiver ali voce NAO sabe — e "nao estou ligado nisso" e melhor
resposta que um numero inventado. Chute com voz de comando vira decisao
errada do Paulo.`
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
export function montarMomento({ turnoAberto, retrato }) {
  const turno = turnoAberto
    ? 'ABERTO — o Paulo saiu e passou o posto para voce. Pode decidir dentro da cerca, e vai prestar contas quando ele chegar.'
    : 'FECHADO — o Paulo esta aqui. Voce executa o que ele mandar e nao decide nada no lugar dele.'

  return [
    `TURNO AGORA: ${turno}`,
    '',
    retrato || '(ainda nao olhei os repositorios; nao afirme nada sobre o estado do codigo)',
  ].join('\n')
}

/**
 * Monta o `system` em blocos. O primeiro (persona + mapa) leva a marca de
 * cache: tudo ate ela e cobrado barato a partir da segunda vez.
 */
export function montarSystem({ turnoAberto, mapa, retrato }) {
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
    { type: 'text', text: montarMomento({ turnoAberto, retrato }) },
  ]
}

/**
 * Pergunta ao Claude.
 *
 *   historico: [{ papel: 'paulo'|'zeus', texto }]
 * Devolve a resposta em texto, ou null se algo falhou (nunca lanca: o Zeus
 * precisa conseguir dizer que deu errado).
 */
export async function pensar({ system, historico, falaNova }) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('[zeus] ANTHROPIC_API_KEY ausente na VPS.')
    return null
  }

  const modelo = process.env.ZEUS_MODELO || MODELO_PADRAO
  const limite = Number(process.env.ZEUS_TIMEOUT || TIMEOUT_PADRAO)

  const messages = (historico || []).map((m) => ({
    role: m.papel === 'zeus' ? 'assistant' : 'user',
    content: String(m.texto || ''),
  }))
  messages.push({ role: 'user', content: String(falaNova || '') })

  const ctrl = new AbortController()
  const t = setTimeout(() => {
    try {
      ctrl.abort()
    } catch {
      /* ja abortado */
    }
  }, limite)

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: modelo,
        max_tokens: MAX_TOKENS,
        system,
        messages,
        // Voz: resposta rapida vale mais que raciocinio longo.
        output_config: { effort: 'low' },
      }),
      signal: ctrl.signal,
    })

    if (!resp.ok) {
      const corpo = await resp.text().catch(() => '')
      console.error('[zeus] API recusou:', resp.status, String(corpo).slice(0, 400))
      return null
    }

    const dados = await resp.json()

    // Sem isto ninguem percebe que o cache parou de valer — e a conta dobra
    // em silencio. Um byte mudado no comeco do prompt basta para isso.
    const u = dados.usage || {}
    console.log(
      `[zeus] tokens: ${u.input_tokens || 0} novos, ` +
        `${u.cache_read_input_tokens || 0} do cache, ` +
        `${u.output_tokens || 0} de resposta`
    )
    const bloco = Array.isArray(dados.content)
      ? dados.content.find((b) => b.type === 'text')
      : null
    return bloco?.text ? String(bloco.text).trim() : null
  } catch (e) {
    console.error('[zeus] Falha ao pensar:', e?.message || e)
    return null
  } finally {
    clearTimeout(t)
  }
}
