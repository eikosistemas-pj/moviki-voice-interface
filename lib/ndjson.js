// lib/ndjson.js  (repo: moviki-voice-interface)
//
// LER UMA RESPOSTA QUE CHEGA AOS POUCOS.
//
// O servidor do Zeus nao devolve mais um JSON so no fim: devolve uma linha de
// JSON por frase pronta, conforme ele pensa (ver servidor/zeus.js). Isto aqui
// e o outro lado do cano — transforma os bytes que vao chegando em linhas
// inteiras.
//
// POR QUE `getReader()` E NAO `for await` DIRETO NO CORPO
// Percorrer um ReadableStream com `for await` ainda nao vale em todo
// navegador. `getReader()` vale em todos — e o Zeus roda no Chrome do Paulo,
// nao num navegador escolhido por mim.
//
// UMA LINHA SO SAI INTEIRA
// Um pedaco da rede quase nunca termina exatamente no fim de uma linha. O
// resto fica guardado e se junta ao pedaco seguinte; entregar meia linha
// faria o JSON.parse falhar e o Zeus perder a frase.

export async function* lerLinhas(corpo) {
  if (!corpo?.getReader) return
  const leitor = corpo.getReader()
  const decodificador = new TextDecoder()
  let sobra = ''

  try {
    for (;;) {
      const { done, value } = await leitor.read()
      if (done) break
      sobra += decodificador.decode(value, { stream: true })
      const linhas = sobra.split('\n')
      // A ultima pode estar pela metade: guarda para o proximo pedaco.
      sobra = linhas.pop() || ''
      for (const linha of linhas) {
        if (linha.trim()) yield linha
      }
    }
    if (sobra.trim()) yield sobra
  } finally {
    try {
      leitor.releaseLock()
    } catch {
      /* ja estava solto */
    }
  }
}
