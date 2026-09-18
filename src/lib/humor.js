import { HUMORES } from '../config/voz'

/**
 * Deduz o humor do Zeus a partir do texto que ele vai falar.
 *
 * Heuristica de palavras e pontuacao, de proposito: e barata, roda no
 * navegador e nao gasta chamada de IA. Se o atendente passar a devolver o
 * humor junto da resposta, `detectarHumor` deixa de ser necessaria — a
 * interface so consome o resultado.
 *
 * O Zeus e uma inteligencia de comando. A ordem de prioridade abaixo
 * reflete isso: firmeza e impaciencia vencem entusiasmo, porque um
 * assistente serio nao sorri em cima de um alerta.
 */

const FIRMEZA = [
  'nao', 'nunca', 'jamais', 'negado', 'recusado', 'bloqueado', 'proibido',
  'atencao', 'alerta', 'cuidado', 'risco', 'perigo', 'critico', 'grave',
  'erro', 'falha', 'problema', 'irregular', 'suspenso', 'cancelado',
  'inadimplente', 'vencido', 'pendencia', 'obrigatorio', 'imediato',
]

const IMPACIENCIA = [
  'aguarde', 'aguardando', 'ainda', 'novamente', 'denovo', 'repito',
  'reforco', 'lembrete', 'pendente', 'processando', 'demora', 'demorando',
  'verificando', 'analisando', 'calma', 'paciencia',
]

const ENTUSIASMO = [
  'excelente', 'otimo', 'otima', 'parabens', 'sucesso', 'aprovado',
  'conquista', 'recorde', 'crescimento', 'lucro', 'ganho', 'aumento',
  'fechamos', 'vendido', 'comissao', 'meta',
]

const FELIZ = [
  'pronto', 'feito', 'concluido', 'confirmado', 'certo', 'perfeito',
  'resolvido', 'atualizado', 'registrado', 'recebido', 'obrigado',
  'disponivel', 'ativo', 'funcionando', 'ok',
]

/** Remove acentos e baixa a caixa: compara sem depender de digitacao. */
function normalizar(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function contar(texto, lista) {
  let total = 0
  for (const termo of lista) {
    // Fronteira de palavra para "ok" nao casar dentro de "okapi".
    const re = new RegExp(`(^|[^a-z0-9])${termo}([^a-z0-9]|$)`)
    if (re.test(texto)) total += 1
  }
  return total
}

export function detectarHumor(textoBruto) {
  if (!textoBruto?.trim()) return HUMORES.NEUTRO

  const texto = normalizar(textoBruto)

  const pontos = {
    [HUMORES.FIRMEZA]: contar(texto, FIRMEZA) * 2,
    [HUMORES.IMPACIENCIA]: contar(texto, IMPACIENCIA) * 2,
    [HUMORES.ENTUSIASMO]: contar(texto, ENTUSIASMO) * 2,
    [HUMORES.FELIZ]: contar(texto, FELIZ),
  }

  // Exclamacao intensifica, mas nao decide sozinha: num texto de alerta ela
  // reforca a firmeza, nao vira comemoracao.
  const exclamacoes = (textoBruto.match(/!/g) || []).length
  if (exclamacoes > 0) {
    if (pontos[HUMORES.FIRMEZA] > 0) pontos[HUMORES.FIRMEZA] += exclamacoes
    else pontos[HUMORES.ENTUSIASMO] += exclamacoes
  }

  // Frase longa com muitas virgulas e explicacao arrastada: soa impaciente.
  if ((textoBruto.match(/,/g) || []).length >= 4) {
    pontos[HUMORES.IMPACIENCIA] += 1
  }

  const ordem = [
    HUMORES.FIRMEZA,
    HUMORES.IMPACIENCIA,
    HUMORES.ENTUSIASMO,
    HUMORES.FELIZ,
  ]

  let vencedor = HUMORES.NEUTRO
  let maior = 0
  for (const humor of ordem) {
    if (pontos[humor] > maior) {
      maior = pontos[humor]
      vencedor = humor
    }
  }

  return vencedor
}
