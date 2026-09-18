# Zeus · Voz

Interface de voz do **ZEUS**, assistente de voz oficial do ecossistema
MOVIKI. React + Vite + Tailwind.

A sintese roda no proprio servidor pelo servico `zeus-voz` (Kokoro, local,
Apache-2.0): sem ElevenLabs, sem chave de API, sem custo por caractere.

## Abrir para testar

    ./abrir-zeus.sh

O script confere se a voz esta de pe, sobe o Vite e imprime o endereco.

Parametros de URL uteis:

| URL | Para que serve |
|---|---|
| `?calibrar=1` | miras sobre olhos, boca, painéis e pontos do mapa |
| `?humor=firmeza` | forca a expressao (tambem: `impaciencia`, `entusiasmo`, `feliz`) |

## A imagem `public/zeus.png`

O painel usa `public/zeus.png` como base visual: o robo ao centro e as
telas da MOVIKI ao redor. **Esse arquivo nao esta no repositorio** — quem
o produz e o Paulo.

Sem ele, a interface **nao quebra**: cai para um rosto geometrico em SVG
(`src/components/RostoZeus.jsx`) e segue operando.

### Calibracao (obrigatoria, uma vez)

As camadas animadas (olhos, boca, brilhos dos painéis) sao posicionadas em
porcentagem em `src/config/painel.js`. Os valores atuais sao um **palpite**
para um rosto centralizado em 16:9 — nao ha como acertar sem a imagem.

1. coloque `zeus.png` em `public/`
2. abra com `?calibrar=1`
3. ajuste os numeros de `src/config/painel.js` ate as marcas cairem nos
   alvos: magenta nos olhos/boca, verde nos painéis, ambar nos pontos
4. recarregue sem o parametro

## Como a voz chega na tela

    React (useVozZeus)
      -> POST /api/voz          (proxy do Vite)
      -> zeus-voz em :8123      (Kokoro, local)
      -> WAV -> <audio> -> AnalyserNode -> boca oscila

A boca le a amplitude REAL do audio (RMS por frame), nao uma animacao
solta: quando o Zeus se cala, as barras baixam.

## Voz travada

`im_nicola` (Nicola), fixada em `src/config/voz.js` e tambem no servidor
(`ZEUS_VOZ_PADRAO` na unit systemd). Nao existe seletor na tela, por
decisao de escopo.

> Nota tecnica: a voz **nao** vem do `speechSynthesis` do navegador. Essa
> API expoe apenas vozes instaladas no sistema de cada visitante (lista
> vazia em Linux headless, diferente em cada Windows/Mac) e nao da acesso
> ao stream de audio — o que tornaria impossivel travar a voz para todos e
> mover a boca pelo som real.

## Estrutura

    src/App.jsx                      orquestra estado, humor e layout
    src/components/PainelZeus.jsx    imagem + camadas alinhadas
    src/components/CamadasPainel.jsx brilhos dos painéis e mapa
    src/components/BocaOndas.jsx     grafico de ondas audio-reativo
    src/components/RostoZeus.jsx     rosto SVG de reserva
    src/components/BotaoMicrofone.jsx
    src/config/painel.js             COORDENADAS (calibrar aqui)
    src/config/voz.js                voz travada, humores, estados
    src/hooks/useVozZeus.js          fala + amplitude do audio
    src/hooks/useEscuta.js           fala -> texto (Web Speech API)
    src/lib/humor.js                 humor a partir do texto

## Requisitos do navegador

- **Microfone** exige **HTTPS ou localhost**. Por IP em HTTP puro o
  navegador bloqueia (regra de origem segura, nao e bug).
- **Reconhecimento de fala** funciona em Chrome e Edge; Firefox nao
  suporta e a interface avisa.
- **Audio** so toca apos a primeira interacao na pagina (autoplay).

## Falta ligar ao cerebro

`responder()` em `App.jsx` devolve resposta de exemplo. Trocar por um fetch
para `/api/atendimento` (no `moviki-ai`) liga os dois — o humor continua
saindo do texto, sem mudanca na interface.

## Producao

Sirva o build (`npm run build` -> `dist/`) pelo Nginx e passe `/api/voz`
para `127.0.0.1:8123` no mesmo dominio, para evitar CORS. Com HTTPS, o
microfone passa a funcionar.

## A trava do Zeus (turno)

O Zeus nao e atendente de cliente: e o posto de comando do Paulo. Ele aciona
as cadeiras do time e, quando o Paulo nao esta, decide no lugar dele. A trava
que separa uma coisa da outra vive em `lib/turno.js`, com teste em
`lib/turno.test.js` (`npm run teste`).

Como funciona, em uma frase por linha:

- **Fora do turno** o Zeus so executa ordem direta. Nao decide nada.
- **"Zeus, assuma daqui"** abre o turno — e so abre com a voz do Paulo
  conferida. E o unico comando do sistema que exige prova.
- **"Zeus, acabei de chegar"** fecha o turno. Fechar e sempre possivel, com ou
  sem a voz conferida: se o conferidor falhar, o Paulo nao pode ficar trancado
  do lado de fora enquanto o robo trabalha sozinho.
- **O turno nao vence por tempo.** Decisao do Paulo em 18/09/2026: ele abre
  quando sai e fecha quando chega, sem relogio no meio. Ha teste cravando isso.
- **Ha assunto que nunca e do robo**, com turno aberto ou fechado: aprovar
  Pull Request, preco, plano, dinheiro, seguranca, segredo, publicar nas redes
  e apagar coisa. Sao as regras de ouro do mapa mestre.
- **Na duvida ele para e deixa anotado.** Pedido que ninguem previu e negado.

### Onde a trava roda

No **servidor**, nunca na tela. O que roda no navegador qualquer um edita com
o console aberto — mesma razao pela qual dinheiro e status no Moviki sao
sempre server-side. `lib/turno.js` e so a decisao: sem tela, sem banco e sem
chave, para poder ser provada por teste.

### O que ainda falta (nao esta no ar)

- O **conferidor de voz** (reconhecer que quem falou foi o Paulo). Mora junto
  do `zeus-voz` no servidor, que hoje nao esta em repositorio nenhum.
- O **registro do turno** gravado (aberto/fechado, quando, por quem) e a
  **trilha** do que o Zeus fez enquanto o Paulo estava fora.
- O **caminho de comando**: o Zeus acionando de fato as cadeiras do time.

### Risco aceito, registrado

Abertura de turno **so por voz**, por decisao do Paulo em 18/09/2026, contra a
recomendacao de exigir tambem confirmacao na tela. Voz pode ser gravada: quem
tiver um audio dele dizendo a frase de abertura assume o lugar dele. Reduz-se
com conferencia de voz e frase que muda a cada vez; nao se elimina.
