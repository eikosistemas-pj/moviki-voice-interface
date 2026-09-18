// servidor/vigia.js  (repo: moviki-voice-interface)
//
// O ZEUS CHAMANDO O PAULO POR CONTA PROPRIA.
//
// O PEDIDO — 18/09/2026
// "Paulo, deu alguma coisa errada aqui. Paulo, precisamos dar uma olhada
// nisso." O Paulo nao quer um robo que responde: quer um que CHAMA.
//
// O QUE MUDA EM RELACAO AO AVISO DE TAREFA
// O aviso conta o que o proprio Zeus fez. O vigia conta o que ELE PERCEBEU —
// coisa que ninguem pediu para ele olhar. E a diferenca entre um funcionario
// que entrega o que foi mandado e um que bate na porta para dizer que tem
// fumaca saindo da cozinha.
//
// O PERIGO DESTE ARQUIVO E O EXCESSO, NAO A FALTA
// Assistente que fala demais e desligado na primeira semana, e ai nao avisa
// nem o que importava. Por isso, tres regras duras:
//
//   1. CADA ASSUNTO FALA UMA VEZ. Enquanto a situacao nao mudar, ele cala.
//      Repetir "tem Pull Request esperando" de doze em doze segundos seria
//      insuportavel em dois minutos.
//   2. TEM DESCANSO ENTRE AVISOS. Mesmo com tres coisas erradas ao mesmo
//      tempo, ele conta uma e espera.
//   3. SO O QUE O PAULO PODE RESOLVER. "A memoria esta em 61%" nao e aviso,
//      e ruido. Aviso e o que pede acao dele.
//
// NADA AQUI PASSA PELO CEREBRO
// Perceber nao e pensar. Estas sao contas que o servidor faz sozinho, de
// graca e na hora — e uma frase que ja se sabe qual e nao precisa de modelo
// para ser escrita.

/** Quanto tempo o mesmo assunto fica calado depois de falado. */
const SILENCIO_POR_ASSUNTO_MS = 6 * 60 * 60 * 1000

/** Descanso minimo entre dois avisos quaisquer. */
const DESCANSO_MS = 10 * 60 * 1000

/** A partir de quantas horas um Pull Request parado vira assunto. */
const HORAS_PR_PARADO = 6

/** Abaixo disso a maquina esta apertando de verdade. */
const MEMORIA_BAIXA_MB = 150

/** Quanto do teto diario gasto antes de ele comentar. */
const FRACAO_TETO = 0.8

/**
 * O que o Zeus percebeu que vale uma chamada.
 *
 *   fatos: {
 *     memoriaLivreMb, vozDePe, usadasHoje, limiteDia,
 *     prsParados: [{ repo, titulo, horas }],
 *   }
 *   jaFalados: { chave: quando }   — o que ele ja disse, e quando
 *
 * Devolve { chave, fala } ou null. UM de cada vez, de proposito.
 */
export function avaliar(fatos, jaFalados = {}, agora = Date.now()) {
  const f = fatos || {}

  // Descanso: se ele falou ha pouco, cala. Vale para QUALQUER assunto — tres
  // problemas ao mesmo tempo nao viram tres frases seguidas.
  const ultimo = Math.max(0, ...Object.values(jaFalados).map(Number).filter(Boolean))
  if (ultimo && agora - ultimo < DESCANSO_MS) return null

  const podeFalar = (chave) => {
    const quando = Number(jaFalados[chave]) || 0
    return agora - quando > SILENCIO_POR_ASSUNTO_MS
  }

  // A ordem e a da urgencia: o que esta quebrado vem antes do que esta
  // esperando, que vem antes do que so e bom saber.

  // 1. A voz caiu. Ele consegue pensar mas nao falar — e o Paulo so descobre
  //    isso quando tentar conversar. Vale interromper.
  if (f.vozDePe === false && podeFalar('voz_caiu')) {
    return {
      chave: 'voz_caiu',
      fala: 'Paulo, o servico de voz caiu aqui na maquina. Estou sem conseguir falar direito.',
    }
  }

  // 2. A maquina apertando. Ja aconteceu antes nesta VPS: sem memoria, o
  //    sistema comeca a matar programas, e a voz e o primeiro a morrer.
  if (Number.isFinite(f.memoriaLivreMb) && f.memoriaLivreMb < MEMORIA_BAIXA_MB) {
    if (podeFalar('memoria')) {
      return {
        chave: 'memoria',
        fala: `Paulo, a maquina esta apertando de memoria, sobrou pouco. Vale dar uma olhada antes que ela comece a derrubar as coisas.`,
      }
    }
  }

  // 3. Pull Request parado esperando ele. O trabalho so vale quando entra no
  //    ar, e quem junta na main e o Paulo — ninguem mais vai lembrar.
  const parados = (f.prsParados || []).filter((p) => p.horas >= HORAS_PR_PARADO)
  if (parados.length && podeFalar('prs_parados')) {
    const fala =
      parados.length === 1
        ? `Paulo, tem um Pull Request esperando sua aprovacao ha mais de ${HORAS_PR_PARADO} horas, no ${parados[0].repo}.`
        : `Paulo, tem ${parados.length} Pull Requests esperando sua aprovacao ha horas. Enquanto voce nao aprova, nada disso esta no ar.`
    return { chave: 'prs_parados', fala }
  }

  // 4. O teto do dia chegando. Melhor ele avisar antes de emudecer do que
  //    emudecer e deixar o Paulo achando que quebrou.
  if (
    Number.isFinite(f.usadasHoje) &&
    Number.isFinite(f.limiteDia) &&
    f.limiteDia > 0 &&
    f.usadasHoje >= f.limiteDia * FRACAO_TETO &&
    podeFalar('teto_perto')
  ) {
    return {
      chave: 'teto_perto',
      fala: 'Paulo, ja usei quase todo o meu limite de falas de hoje. Depois disso eu fico quieto ate amanha.',
    }
  }

  return null
}
