# O FORMATO COMUM DO AGENTE — o passo 1 do CRM

**Para que serve este arquivo:** o CRM do Paulo põe os agentes lado a lado numa
tela só. Este documento diz **em que formato cada agente se apresenta** — um
formato só, igual para todos.

> **O cuidado que ele existe para evitar** (`ESTADO-DO-CRM.md`, seção 3.1): se
> cada agente publicar o estado do jeito dele, cada agente novo vira um pedaço
> de tela novo. Em três agentes a tela vira colcha de retalho, e em cinco
> ninguém mexe mais nela.

Quem implementa isso no `moviki-ai`, no `moviki-assistente-social` ou no
`moviki-robo` copia este formato. Não adapta: copia. O que for próprio do
agente vai no campo `proprio`, no fim — e a tela continua inteira mesmo que
ninguém entenda aquele pedaço.

**A primeira implementação já existe e está no ar neste repositório:**
`servidor/painel.js`, servida em `GET /api/zeus/painel`.

---

## 1. A regra que vale acima de todas as outras

**Campo sem dado é `null`. Nunca zero. Nunca texto vazio.**

Zero é uma afirmação: *"gastei zero hoje"*. `null` é uma confissão: *"não sei
quanto gastei"*. São coisas diferentes, e num painel de controle confundir as
duas é o mesmo defeito que o Zeus tinha em 18/09/2026, quando dizia que estava
trabalhando em coisa que não existia — só que em forma de número.

**Quem desenha a tela mostra `null` como "não sei"**, com essas palavras, e
nunca como um traço, um zero ou um espaço em branco.

---

## 2. O formato

```json
{
  "formato": 1,
  "agente": "zeus",
  "nome": "Zeus",
  "papel": "comando",
  "em": "2026-09-18T19:29:02.137Z",

  "vivo": true,
  "desdeEm": "2026-09-18T19:28:52.214Z",
  "ligado": true,
  "podeDesligar": false,
  "porQueNaoDesliga": "desligar o Zeus e so do dono, pela VPS",

  "fazendoAgora": [
    {
      "oQue": "muda a cor do botao do painel",
      "onde": "moviki-app",
      "desdeEm": "2026-09-18T19:22:00.000Z",
      "minutos": 7
    }
  ],

  "ultimaFalha": {
    "em": "2026-09-18T18:40:00.000Z",
    "minutos": 49,
    "oQue": "mexer no atendente",
    "motivo": "parei no meio e nao voltei"
  },

  "gasto": {
    "moeda": "BRL",
    "dolar": 5.6,
    "hoje": { "reais": 2.28, "chamadas": 3, "semPreco": 0, "completo": true },
    "mes":  { "reais": 41.90, "chamadas": 180, "semPreco": 0, "completo": true },
    "porTipo": { "conversa": 0.08, "trabalho": 1.88, "busca": 0.32 }
  },

  "proprio": { }
}
```

### Campo por campo

| Campo | O que é | Quando é `null` |
|---|---|---|
| `formato` | a versão deste documento. Sobe quando a mudança quebrar quem já lia | nunca |
| `agente` | o nome curto, sem espaço: `zeus`, `atendente`, `redes`, `robo` | nunca |
| `nome` / `papel` | como aparece escrito na tela | nunca |
| `em` | o instante deste retrato. **Sem ele a tela não sabe se está velha** | nunca |
| `vivo` | ele está de pé | — ver 3 |
| `desdeEm` | de pé desde quando | se o agente não sabe a hora em que subiu |
| `ligado` | ligado ou desligado pelo painel | nunca |
| `podeDesligar` | se a tela desenha o botão de desligar | nunca |
| `fazendoAgora` | **lista** do que está em andamento, com o relógio | nunca — lista vazia quer dizer parado, e isso é informação |
| `ultimaFalha` | a última coisa que deu errado, **com o motivo** | quando não houve nenhuma registrada |
| `gasto` | quanto custou, em reais | quando o agente ainda não sabe contar o próprio gasto |
| `proprio` | o que só aquele agente tem | nunca — objeto vazio se não tiver nada |

---

## 3. As quatro colunas da tela, e o que cada uma exige

O `ESTADO-DO-CRM.md`, seção 3.1, pediu cinco colunas. Elas saem daqui assim:

| Coluna da tela | De onde sai | O cuidado |
|---|---|---|
| **Está de pé?** | `vivo` | **Agente nenhum consegue avisar que morreu.** Quem responde está vivo; quem não responde é que a tela mostra como "não sei" — e depois de um tempo, como caído. A tela decide isso, não o agente |
| **O que faz agora** | `fazendoAgora` | Sempre com `minutos`. Sem o relógio ele volta a inventar |
| **Gastou quanto hoje** | `gasto.hoje.reais` | Se `completo` for `false`, o total **não fecha**: mostrar "R$ 2,28 + não sei", nunca só "R$ 2,28" |
| **O que deu errado** | `ultimaFalha.motivo` | O motivo com todas as letras. "Erro" não serve para quem não é programador: não diz se espera, se manda tentar de novo, ou se o problema é outro |
| **Ligar / desligar** | `ligado` + `podeDesligar` | `podeDesligar: false` faz o botão **não existir**. Trava que depende de alguém lembrar de não clicar não é trava |

### Sobre `podeDesligar`

A decisão 6.1 do Paulo: **o Zeus desliga qualquer agente; desligar o Zeus é só
do dono.** No formato isso é um campo, e não uma regra escrita em algum lugar
que alguém vai esquecer: o retrato do Zeus vem com `podeDesligar: false` e o
painel simplesmente não desenha o botão.

Os outros três agentes vêm com `podeDesligar: true`.

---

## 4. Como o agente publica

| Agente | Caminho |
|---|---|
| **Zeus** | rota própria: `GET /api/zeus/painel`, atrás do crachá, origem nominal. **Feito** |
| **Os outros três** | gravam este mesmo objeto no Firestore, que o painel do dono já lê com a credencial do Paulo |

O Zeus é o único que precisa de rota: ele mora numa VPS que **nunca ganha a
chave do Firestore** (`ESTADO-DO-ZEUS.md`, seção 5.5). Os outros já vivem do
lado de lá e não têm esse problema — para eles, escrever um documento é mais
simples e mais barato que levantar uma rota.

**A rota é de LEITURA.** Ligar e desligar agente é escrita, e escrita merece
rota própria, com registro de quem mandou e por quê. Isso é o passo 8 do plano,
de propósito o último.

---

## 5. O custo em reais — como cada agente calcula

O Paulo decidiu: **reais**. Não tokens, não "quanto do teto".

No Zeus a conta mora em dois arquivos, e quem for fazer nos outros agentes
copia a ideia:

- `servidor/precos.js` — **a tabela de preço, num lugar só.** Preço por modelo,
  em dólar por milhão de tokens, mais a busca na internet (que é cobrada por
  busca, não por token). A cotação do dólar vem do `zeus.env`.
- `servidor/gasto.js` — **o caderno de despesa.** Anota cada chamada paga, vira
  a página do dia e a do mês sozinho.

Duas regras que vieram junto:

1. **Modelo fora da tabela não ganha preço chutado.** A chamada entra como
   `semPreco`, o total vira `completo: false`, e a tela mostra que não fecha.
2. **A tabela envelhece, e envelhecer não é defeito.** O defeito seria ela
   estar espalhada por quatro arquivos e envelhecer em quatro velocidades.

---

## 6. O que este formato NÃO tem, de propósito

- **Nada do funil de lojistas.** Funil é a outra metade do CRM e sai do
  Firestore, que o painel já lê. Misturar as duas coisas num objeto só faria o
  Zeus precisar enxergar dado de lojista — e ele não precisa.
- **Nada de histórico.** Este é um retrato de agora. Histórico é outra tela, e
  outra decisão.
- **Nenhum segredo.** Nem chave, nem token, nem senha, nem trecho de código. O
  retrato atravessa a internet até o navegador do Paulo; o que não pode vazar
  não entra aqui.
