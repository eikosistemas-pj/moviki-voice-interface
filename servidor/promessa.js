// servidor/promessa.js  (repo: moviki-voice-interface)
//
// O GUARDA-PROMESSA — a rede embaixo da lista de verbos.
//
// O DEFEITO — 18/09/2026, tres vezes no mesmo dia
// O Paulo: *"ele aceita, diz que vai fazer, depois daqui a dois minutos ele
// diz que ainda e pra eu fazer"*. E o proprio Zeus, para ele, com todas as
// letras: *"o disparo nao esta pegando"*.
//
// Ele estava certo, e a frase dele descreve melhor do que eu descreveria. A
// ordem caia na CONVERSA em vez de virar tarefa. Na conversa o Zeus responde
// bonito, concorda e promete — e nao ha nada do outro lado para fazer. Dois
// minutos depois, olhando a lista de tarefas em andamento (vazia, e
// honestamente vazia), ele dizia que nao havia nada.
//
// POR QUE ALARGAR A LISTA DE VERBOS NAO BASTA
// A rodada anterior alargou `VERBO_DE_MUDANCA` em `comando.js`. Isso conserta
// as frases que eu consegui imaginar — mas a lista e uma aposta sobre o
// vocabulario de OUTRA pessoa, e toda aposta dessas perde um dia. Basta o
// Paulo dizer "da um jeito naquele rodape" para a ordem sumir de novo.
//
// A REDE NAO DEPENDE DE EU ADIVINHAR PALAVRA NENHUMA.
// O Zeus acabou de LER a frase inteira, com o contexto todo, e responder. Se a
// resposta dele foi uma promessa, entao ELE entendeu que era ordem — e ele e
// um classificador melhor que qualquer lista que eu escreva. A promessa vira
// tarefa no mesmo segundo.
//
// PROMESSA SEM TAREFA E MENTIRA, e a regra vale nos dois sentidos: ou o Zeus
// nao promete, ou o que ele prometeu comeca a acontecer de verdade.
//
// ISTO AQUI E SO A DECISAO, sem efeito nenhum sobre o mundo. Quem abre tarefa
// e quem fala e o `zeus.js`. Separado de proposito: e aqui que moram as cercas,
// e cerca precisa caber num teste que roda em milissegundos, sem subir
// servidor, sem chave de API e sem tocar em disco.

import { assuntoVedado, prometeuFazer, repoDoAssunto } from './comando.js'

/**
 * O que fazer com a resposta que o Zeus acabou de dar.
 *
 *   resposta  o que ele falou (o texto inteiro, ja pronto)
 *   ordem     o que o Paulo tinha falado
 *   temToken  se o GitHub esta ao alcance
 *
 * Devolve `{ o, tipo, repo }`, onde `o` e um de:
 *
 *   null            ele nao prometeu nada. Conversa comum, segue a vida.
 *   'disparar'      prometeu e da para fazer — `tipo` diz se e trabalho ou
 *                   analise, `repo` diz onde.
 *   'vedado'        prometeu mexer em coisa que nunca e do robo.
 *   'faltou_onde'   prometeu e nao da para saber em que parte do Moviki.
 *   'faltou_token'  prometeu mexer no codigo e o GitHub nao esta ao alcance.
 */
export function decidirPromessa({ resposta, ordem, temToken }) {
  const tipo = prometeuFazer(resposta)
  if (!tipo) return { o: null, tipo: null, repo: null }

  // A CERCA VEM ANTES DO DISPARO, e sem exigir verbo de mudanca na frase do
  // Paulo — porque quem disse que ia mexer foi o ZEUS.
  //
  // Sem isto, "e o Premium, da para ficar mais caro?" respondido com "vou
  // ajustar" abriria a porta do preco pelo caminho novo. Seria eu abrindo, com
  // um conserto, exatamente a porta que a trava existe para manter fechada.
  if (assuntoVedado(ordem, { exigeVerbo: false })) {
    return { o: 'vedado', tipo, repo: null }
  }

  const repo = repoDoAssunto(ordem)
  // Prometeu e nao da para saber onde mexer. Perguntar AGORA, na mesma
  // resposta, e melhor que a promessa evaporar em silencio — que e o defeito
  // inteiro que este arquivo existe para fechar.
  if (!repo) return { o: 'faltou_onde', tipo, repo: null }

  // Analise nao passa pelo GitHub com escrita: ler o espelho basta.
  if (tipo === 'trabalho' && !temToken) return { o: 'faltou_token', tipo, repo }

  return { o: 'disparar', tipo, repo }
}
