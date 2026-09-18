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
