// servidor/aviso.js  (repo: moviki-voice-interface)
//
// O ZEUS CHAMANDO O PAULO QUANDO TERMINA.
//
// O PROBLEMA — 18/09/2026
// O trabalho corre por fora da conversa e termina sozinho. Ate agora, o Zeus
// so contava o resultado quando o Paulo falasse com ele de novo — o que
// significa o Paulo ficar espiando o repositorio de minuto em minuto, ou
// descobrir o Pull Request muito depois. Robo que termina e nao avisa e pior
// que robo que nao faz: pelo menos o que nao faz nao gera trabalho esquecido.
//
// COMO ELE AVISA
// A tela pergunta de tempos em tempos se ha novidade. Havendo, ela fala. Nao
// e o servidor que empurra: navegador nao tem campainha, e montar um cano
// aberto so para isso seria peso a mais numa maquina de 2 GB.
//
// A FRASE E MONTADA AQUI, NAO PELO CEREBRO
// De proposito: avisar nao e pensar. Passar pelo modelo custaria dinheiro e
// segundos para dizer uma frase que ja se sabe qual e — e, pior, ele poderia
// resolver enfeitar.
//
// O AVISO NAO INTERROMPE
// Quem chama a tela decide a hora: ela so deixa ele falar quando o microfone
// esta fechado e ele nao esta falando. Robo que corta a fala do dono e robo
// que o dono desliga.

/** Como o Zeus conta UMA tarefa terminada. */
export function fraseDeAviso(tarefa) {
  if (!tarefa) return null

  // ANALISE: a entrega e a RESPOSTA, nao um link.
  //
  // Aqui o aviso nao anuncia o resultado — ele E o resultado. Dizer "terminei
  // a analise, me pergunte de novo" obrigaria o Paulo a pedir duas vezes a
  // mesma coisa, que e exatamente o tipo de atrito que faz ele preferir fazer
  // na mao.
  if (tarefa.tipo === 'analise') {
    if (tarefa.ok && tarefa.resposta) return tarefa.resposta
    const porque = (tarefa.erros || []).join('; ')
    return `Olhei o que voce pediu sobre ${tarefa.ordem} e nao consegui fechar uma resposta. ${porque}`
  }

  if (tarefa.ok) {
    // O link nao e falado: soletrar endereco em voz alta e tortura. Ele fica
    // na resposta escrita, para a tela mostrar ou o Paulo abrir depois.
    return `Terminei o que voce pediu sobre ${tarefa.ordem}. Abri o Pull Request, esta esperando voce aprovar.`
  }

  const motivo = (tarefa.erros || []).join('; ')
  return `Nao consegui fazer o que voce pediu sobre ${tarefa.ordem}. ${motivo}`
}

/**
 * Junta as tarefas terminadas numa fala so.
 *
 * Duas tarefas prontas nao viram dois avisos seguidos: o Zeus falaria por
 * cima de si mesmo e o Paulo perderia a primeira.
 */
export function montarAviso(tarefas) {
  const prontas = (tarefas || []).filter(Boolean)
  if (prontas.length === 0) return null
  if (prontas.length === 1) {
    return { fala: fraseDeAviso(prontas[0]), links: prontas.map((t) => t.link).filter(Boolean) }
  }

  const frases = prontas.map((t) => fraseDeAviso(t)).filter(Boolean)
  return {
    fala: `Terminei ${prontas.length} coisas. ${frases.join(' ')}`,
    links: prontas.map((t) => t.link).filter(Boolean),
  }
}
