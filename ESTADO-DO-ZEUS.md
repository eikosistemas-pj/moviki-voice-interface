# ESTADO DO ZEUS — 18/09/2026 (segunda rodada)

**Para que serve este arquivo:** o Paulo trabalha o Zeus por conversas que começam do zero.
Quando uma conversa acaba, a memória dela acaba junto. Este arquivo é a memória que fica.
**Quem abrir um chat novo lê isto primeiro e sabe exatamente onde paramos.**

Mesma regra do `CLAUDE.md` dos outros repositórios: *o repositório é a única fonte da verdade*.

---

## 1. O que o Zeus é

Não é atendente de cliente. É o **posto de comando do Paulo** — fica no lugar dele quando ele não está.

Decisões do Paulo que já estão gravadas em código e não se discutem mais:

| Regra | Onde mora |
|---|---|
| Só assume quando o Paulo disser "Zeus, assuma daqui"; só para quando ouvir "Zeus, acabei de chegar" | `lib/turno.js` |
| **O turno não tem prazo.** Não expira sozinho, nunca | `lib/turno.js` (tem teste fixando isso) |
| Abertura do turno **só por voz** | decisão do Paulo, reafirmada duas vezes |
| Nunca pode se trancar: nunca deixa de receber comando, nunca fecha o próprio código | `servidor/maos.js` |
| **Nunca liga o microfone sozinho.** Só o dedo do Paulo | `src/hooks/useVozZeus.js` |
| Nunca aprova nem junta Pull Request. Isso é do Paulo | `servidor/oficina.js` |
| Nunca mexe em dinheiro, preço, segredo, segurança, nem no `moviki-robo`, nem no próprio código | `lib/turno.js` + `servidor/maos.js` |

---

## 2. Onde ele roda

- **VPS Hetzner CPX12** — 1 vCPU, 2 GB de RAM + 2 GB de swap, Ubuntu 26.04, IP `204.168.204.48`
- Pasta: `/root/eikosistemas/moviki-voice-interface`
- **Três peças no ar:**
  - `zeus-voz` (systemd) — a voz, Kokoro, porta 8123
  - `zeus-cerebro` (systemd) — o servidor do Zeus
  - `frontend-vite` (PM2) — a tela
- **Não tem Nginx e não tem HTTPS ainda.**
- Chaves e senhas ficam em `/etc/zeus/zeus.env` (dono root, 600). Nunca em arquivo do repositório.

Entrar na VPS pelo PowerShell: `ssh root@204.168.204.48`

Publicar uma alteração já aprovada:

```
cd /root/eikosistemas/moviki-voice-interface
git pull
npm run build
systemctl restart zeus-cerebro
pm2 restart frontend-vite
```

---

## 3. O que já está pronto e no ar

| Pull Request | O que entregou |
|---|---|
| #1 | A trava do turno |
| #2 | O Zeus ligado ao cérebro (Claude), com autonomia dentro do turno |
| #3 | **A voz consertada** — estava usando voz *italiana* lendo português. Hoje é `pm_alex`, portuguesa |
| #4 | Dicionário de pronúncia (ele falava "Enterpríse", "Movikí") |
| #5 | **Os olhos** — ele lê os 6 repositórios públicos e o mapa mestre. O `moviki-vault` fica de fora, e tem teste garantindo isso |
| #6 | O estado do turno saiu de vista: saber que o turno está aberto é saber que o Paulo não está olhando |
| #7 | **As mãos** — ordem falada vira Pull Request, em ramo `zeus/…`, nos 4 repositórios permitidos |
| #8 | Ele passou a **chamar o Paulo por voz** sozinho: "Paulo, terminei…", "Paulo, deu alguma coisa errada aqui" |
| #9 | O conserto do trabalho: ele troca **um trecho** do arquivo em vez de reescrever meio milhão de caracteres |
| #10 | **A demora atacada de verdade**, o fim das tarefas zumbis, e **os olhos que respondem** — ver seção 4 |

**Custo:** a conversa roda no modelo barato (Haiku), o trabalho de código no modelo forte (Opus).
O mapa mestre viaja no bloco com desconto de cache — quem repete a mesma base paga menos.
Tem teto diário de chamadas: se o endereço vazar, o prejuízo para no teto em vez de crescer a noite toda.

---

## 4. ⚠️ O PONTO EXATO ONDE PARAMOS

### 4.1 🔴 NADA DISSO ESTÁ NO AR. É ISSO QUE FALTA.

Os Pull Requests **#9 e #10 estão aprovados e na `main`**, mas a VPS ainda roda
o código antigo. Enquanto o bloco abaixo não for rodado, **medir qualquer coisa
é medir o problema velho**:

```
cd /root/eikosistemas/moviki-voice-interface
git pull && npm run build
systemctl restart zeus-cerebro && pm2 restart frontend-vite
```

Depois, **Ctrl+Shift+R** na tela (senão o navegador continua com a tela velha).

> É quase certo que o *"peço uma coisa e ele diz que não conseguiu"* seja
> exatamente isto: o conserto do #9 nunca chegou à máquina.

### 4.2 A demora — o que era, de verdade

O #8 atacou a demora e ela continuou. O motivo: **o conserto do #8 quase nunca
valia.** Ele só partia a resposta em pedaços quando ela passava de 180
caracteres — e a instrução do Zeus manda ele responder em duas ou três frases,
que quase sempre cabem em 180. Ou seja, na maioria das respostas ele continuava
esperando a fala **inteira** virar áudio antes de abrir a boca.

A espera tinha **quatro pedaços em fila, um depois do outro**:

| # | O que era | Dono |
|---|---|---|
| 1 | o navegador decidir que o Paulo parou de falar | o Chrome |
| 2 | o cérebro pensar a resposta **inteira** | a Anthropic |
| 3 | o Kokoro virar a resposta **inteira** em áudio | **a VPS** |
| 4 | o áudio começar a tocar | — |

O #10 fez os três primeiros **andarem juntos em vez de em fila**:

- **O cérebro agora responde em fluxo.** Cada frase pronta sai na hora para a
  tela, em vez de o servidor segurar tudo até a última palavra.
- **O primeiro pedaço de voz agora é pequeno** (uma frase), e os seguintes são
  maiores. Só o primeiro é esperado de boca fechada; os outros são preparados
  enquanto o anterior toca.
- **O microfone entrega a frase assim que ela fecha**, sem esperar o Chrome se
  convencer de que o silêncio acabou. De quebra, o microfone fecha mais cedo.

### 4.3 🔴 Um apagão que estava escondido de lentidão

O #8 mandava `output_config: { effort: low }` junto com o modelo `claude-haiku-4-5`.
**O Haiku 4.5 não aceita esse parâmetro** — a API responde erro e o Zeus fica
**sem resposta nenhuma**, dizendo "não consegui pensar agora".

Isso não é lentidão, é mudez. Corrigido: o parâmetro só vai para modelo que o
aceita. Para confirmar se era isso que estava acontecendo na VPS:

```
journalctl -u zeus-cerebro -n 200 --no-pager | grep "API recusou"
```

Se aparecer alguma linha aí, era isso.

### 4.4 🔴 A resposta medida: **a máquina é o gargalo, mas o código era pior**

O Paulo rodou o `servidor/medir.sh` na VPS em 18/09/2026. Números reais:

| Medida | Valor |
|---|---|
| 62 letras viram áudio em | 3,1s |
| 180 letras viram áudio em | 8,2s |
| → custo por letra | **0,043s** |
| → custo fixo por pedido | **0,42s** |
| → **velocidade da síntese** | **~1,65x o tempo real da fala** |
| O cérebro (do `journalctl`) | **3,3s a 4,0s** por resposta |

**Estes números não podem ser perdidos.** Eles são a base de toda a afinação
em `lib/partirFala.js`. Se a máquina mudar, rodar o `medir.sh` de novo e
reajustar a razão da escada.

**O que eles dizem:**

1. **"1,65x o tempo real" é o número que governa tudo.** Enquanto um pedaço
   toca, dá para preparar um pedaço 1,65 vez maior. Se o pedaço seguinte for
   maior que isso, a fila atrasa e o Zeus cala no meio da resposta.
2. **A máquina é lenta**, mas dá para trabalhar com ela. O que estava
   realmente errado era o código mandar sintetizar tudo de uma vez.
3. **O cérebro demorava 3,5s** e ninguém ouvia nada nesse tempo. Com o fluxo,
   a primeira frase chega em cerca de 1s.

### 4.5 A troca que foi escolhida, e como desfazer

Resposta típica de três frases, na máquina dele:

| | 1ª palavra | Pausas no meio |
|---|---|---|
| Hoje, na VPS | **10,9s** | nenhuma |
| Com o #10 | **1,9s** | uma de ~2,9s |

**A pausa é de propósito.** Ela aparece porque a frase de abertura ("Terminei.")
é curta e a seguinte é grande demais para a máquina preparar no tempo em que
uma palavra toca.

Escolhido assim porque a reclamação do Paulo é o tempo entre **ele falar e o
Zeus responder** — não o ritmo do meio da resposta. Pausa depois de uma resposta
já começada soa como alguém tomando fôlego; dez segundos de silêncio antes de
qualquer som soa como robô quebrado.

> **Se ele disser que ficou picotado:** subir `MINIMO_PRIMEIRO` em
> `lib/partirFala.js` de 8 para 30. Isso junta a abertura com a frase seguinte:
> a 1ª palavra passa para ~5,9s, e a pausa some. É uma linha, e está comentada
> lá.

### 4.6 🔴 O DEFEITO MAIS GRAVE ATÉ AGORA: ele mentia

18/09/2026, à tarde. O Paulo pediu a cor de um botão de manhã e a tarde o Zeus
ainda dizia *"a tarefa está em andamento"*. Pediu uma análise do painel do
parceiro; uma hora depois, *"ainda estou analisando"*.

**As duas frases eram invenção.** Duas causas distintas, as duas minhas:

**1. A tarefa virava zumbi.** O trabalho corre por fora da conversa, sem
`await`, na memória do processo. Se ele reiniciasse — e numa VPS de 2 GB o
sistema mata processo por falta de memória — o trabalho morria junto e a tarefa
ficava gravada como `trabalhando` **para sempre**. E `tarefasParaContar` ignora
o que está `trabalhando`. Ou seja: **a tarefa morta nunca entrava em fila
nenhuma**, e o aviso nunca vinha.

**2. Ele não tinha como saber, então inventava.** No prompt dele só havia
trabalho TERMINADO. Nada sobre trabalho em andamento. Ele lia no histórico da
conversa que tinha dito "vou trabalhar nisso" e repetia aquilo indefinidamente.
E "analisar" nem é verbo de mudança — nunca virou tarefa nenhuma. Ele
simplesmente disse que estava analisando porque soava bem.

#### O que foi feito

| Conserto | Onde |
|---|---|
| Ao subir, toda tarefa `trabalhando` é enterrada — quem trabalhava morreu no restart | `servidor/zeus.js` |
| A ronda enterra o que passou de **12 minutos** | `servidor/zeus.js` |
| O trabalho desiste sozinho em **10 minutos** e conta o que houve | `servidor/trabalho.js` |
| Timeout de 90s por volta | `servidor/trabalho.js` |
| O prompt recebe a lista do que está em andamento, **com o relógio** | `servidor/cerebro.js` |
| Regra dura: **nunca dizer que está trabalhando em algo fora da lista** | `servidor/cerebro.js` |
| Cada volta do trabalho vira registro — dá para ver onde ele se perde | `servidor/trabalho.js` |

**A regra que passa a valer acima das outras:** falha em dez minutos vale mais
que silêncio de seis horas. O Paulo pode mandar tentar de novo ou fazer na mão;
esperando um aviso que não vem, ele não pode nada.

> **Publicar já desentope o que está travado agora:** ao subir, o servidor
> enterra as tarefas zumbis e o Zeus conta o que houve na primeira conversa.

### 4.7 Capacidade: o caminho para ele ser autônomo

> **A regra de crescimento, dada pelo Paulo em 18/09/2026:** *"aos poucos,
> quando a gente for vendo que ele está mais inteligente, a gente vai soltando
> as responsabilidades para ele."* Capacidade primeiro, autoridade depois — e a
> autoridade se solta por decisão dele, escrita, nunca por iniciativa minha.

O Paulo foi direto: *"eu quero um robô que pense sozinho, ache problemas e
resolva, para eu poder descansar."* O que separa o Zeus de hoje disso — em
ordem, e nenhum deles é trava de segurança:

1. ✅ **Ele já sabe ANALISAR** — feito em `servidor/analise.js`. "Analise o
   painel do parceiro", "dá uma olhada no site", "verifica se tem problema no
   atendente": ele lê o código de verdade e responde em voz, **sem abrir Pull
   Request e sem mexer em nada**. Não existe ferramenta de escrever nesse
   caminho. Prazo de 5 minutos — análise que demora não serve para quem está
   esperando falando.
2. ✅ **Ele já acha problema sozinho** — `servidor/patrulha.js`. De 45 em 45
   minutos ele **lê o código** procurando coisa quebrada, texto que engana o
   lojista, e trabalho deixado pela metade. Achando algo que exige decisão do
   Paulo, ele **chama por voz sem ninguém pedir**.

   **É o primeiro pedaço do Zeus que gasta dinheiro sem ninguém ter pedido**, e
   por isso tem quatro freios: só olha repositório que MUDOU (guarda o commit
   que já viu), um de cada vez em rodízio, teto próprio de 12 por dia, e **o
   padrão é o silêncio** — estilo de código e "daria para melhorar" não valem
   interromper. Depois disso ainda passa pelas regras do vigia: cada assunto
   fala uma vez, e há descanso de 10 minutos entre avisos.

   Desligar: `ZEUS_PATRULHA=0` no `zeus.env`.
3. 🟡 **Ele não conversa sobre o trabalho enquanto trabalha.** É tudo ou nada:
   ou abre o PR, ou falha. Não dá para ele dizer "achei três lugares, qual
   deles?" no meio.
4. 🟡 **Ele não sabe se o que ele escreveu funciona.** Não roda teste nem build
   — propõe e torce. Rodar comando é a fronteira que exige decisão do Paulo.

**Esforço do modelo de trabalho subiu para `xhigh`** (era o padrão). Ler código
alheio e acertar a alteração de primeira é exatamente o trabalho que paga
esforço alto: cada volta economizada pensando virava três voltas errando.

### 4.6 O que ainda pode ser feito pela demora

Em ordem de quanto rende, se depois de publicar ainda incomodar:

1. **Mais processadores** (CPX22 ou CPX32 na Hetzner — troca de plano, não
   reinstala nada). Dobrar o processador corta a síntese pela metade e faz a
   pausa da 4.5 desaparecer sozinha. **É o único caminho que ataca a causa.**
2. **Encurtar a resposta dele** de "duas ou três frases" para "uma ou duas" —
   uma linha na instrução, custa detalhe.
3. **Tirar a voz da VPS** para um serviço de fala hospedado. Resolve de vez,
   mas traz dependência nova e conta nova.

### 4.8 🔴 O token do GitHub sumiu — e a causa era o próprio instalador

18/09/2026, fim do dia. O Zeus respondeu que **não tinha o token do GitHub** —
um token que já tinha sido posto.

**A causa raiz:** o `instalar.sh` **reescrevia o arquivo de segredos inteiro,
do zero, toda vez.** Para trocar uma linha era preciso responder todas as
perguntas de novo sem errar nenhuma. Basta uma rodada passar pela pergunta do
token com um Enter e ele é gravado **vazio por cima do que existia**.

Não é só o token: a mesma armadilha apagaria a senha ou a chave da Anthropic.

#### O que foi feito

| | |
|---|---|
| `servidor/token.sh` | Troca **uma** coisa sem encostar no resto. Confere o token contra o GitHub **antes de gravar**, testa os 4 repositórios, faz cópia de segurança e reinicia o serviço |
| `servidor/doutor.sh` | Consulta completa: segredos, token testado de verdade, espelho, serviços, tarefas presas. **Cada falha vem com o comando que resolve** |
| `instalar.sh` | Não apaga mais o que já existe: resposta vazia preserva o valor guardado, e ele faz `.bak` antes de gravar |
| `zeus.js` | Confere o token **ao subir**, não na hora do pedido. Token vencido ou sem permissão aparece no registro antes de estragar um pedido |
| `zeus.js` | A frase dele deixou de ser beco sem saída: termina dizendo o que fazer |

**Comando para o Paulo quando algo estiver estranho:**

```
cd /root/eikosistemas/moviki-voice-interface && bash servidor/doutor.sh
```

### 4.9 🔴 A conversa estava rodando no modelo FORTE, em silêncio

O `instalar.sh` gravava `ZEUS_MODELO=claude-opus-5` no arquivo de segredos.
Como o código lê `process.env.ZEUS_MODELO` antes do padrão, **a VPS anulava em
silêncio a decisão do #8 de pôr a conversa no modelo rápido.** Era isso que
fazia o registro mostrar 3,3s a 4,0s por resposta.

Corrigido no instalador. Para arrumar sem reinstalar:

```
bash servidor/token.sh --modelo-rapido
```

> **Regra que fica:** configuração que mora na VPS pode anular decisão que mora
> no código, e anula **em silêncio**. Quando o comportamento não bater com o
> que o código diz, olhar o `zeus.env` antes de procurar bug.

## 5. Pendências — em ordem de importância

### 5.1 🔴 Trocar a chave da Anthropic (do Paulo, urgente)

A chave apareceu numa captura de tela durante a montagem. **Precisa ser trocada.**
Em `console.anthropic.com`. **A ordem importa, senão o atendente do WhatsApp emudece:**

1. Cria a chave nova do Zeus → põe em `/etc/zeus/zeus.env` na VPS → reinicia o `zeus-cerebro`
2. Cria a chave nova do `moviki-ai` → põe nas Environment Variables do Vercel → publica
3. **Só depois** apaga a chave velha

### 5.2 🔴 HTTPS — **o script está pronto, falta o Paulo criar o subdomínio**

Isto deixou de ser teoria em 18/09/2026: **o Paulo abriu no celular e o microfone
não funcionou.** Não é defeito do Zeus nem do aparelho — navegador nenhum
entrega microfone a uma página sem cadeado. `localhost` é a única exceção, e é
por isso que no computador dele às vezes funciona e no celular nunca.

E a outra metade continua valendo, pior ainda: **a senha dele atravessa a
internet aberta.**

**O que falta é só a parte do Paulo** — criar o registro no painel do domínio:

| Tipo | Nome | Valor |
|---|---|---|
| A | `zeus` | `204.168.204.48` |

Depois, uma linha na VPS:

```
bash servidor/https.sh zeus.moviki.com.br
```

O script confere se o endereço já aponta para a máquina **antes** de pedir o
certificado (a Let's Encrypt limita tentativas erradas por semana), descobre em
que porta a tela está atendendo, instala e configura o Nginx, emite o
certificado e liga a renovação automática.

> **Uma coisa no Nginx que não pode ser perdida:** o bloco de `/api/zeus` tem
> `proxy_buffering off`. Sem isso o Nginx segura o fluxo de frases e entrega
> tudo junto no fim — desfazendo em silêncio todo o conserto da demora e
> devolvendo o Zeus para os dez segundos de espera. Já está no script; se
> alguém reescrever a configuração à mão, tem que continuar lá.

Enquanto não sobe: a tela agora **explica** que o microfone está bloqueado por
falta de endereço seguro, em vez de deixar um botão morto sem dizer nada.

### 5.3 🟡 Conferir a voz de quem abre o turno

Hoje está desligado (`ZEUS_CONFERE_VOZ=0`): **qualquer voz abre o turno, inclusive uma gravação.**
O Paulo sabe disso e aceitou o risco por enquanto — está registrado aqui de propósito.

> **Nunca clonar a voz do Paulo para o Zeus falar.** A fala do Zeus viraria uma gravação da
> voz do Paulo, e o robô passaria a fabricar a chave da própria porta.

### 5.4 🟡 O mapa mestre não conhece este repositório

O `CLAUDE.md` dos outros repositórios diz que o Moviki tem **seis** repositórios. São **sete**:
falta o `moviki-voice-interface`. Pela regra de sincronização, arrumar isso é **um Pull Request
em cada uma das seis cópias, no mesmo ciclo** — nunca uma e "as outras depois".

### 5.5 🟡 Os números do negócio

O Zeus ainda não enxerga faturamento, assinantes nem comissão: isso mora no Firestore, e ler
o Firestore da VPS exigiria levar para lá a chave que alcança o dinheiro de todo lojista.
O Paulo já decidiu: *"dá para resolver de um jeito mais seguro depois, a gente faz"*.
O caminho certo é o `moviki-robo` (que já tem a chave) publicar um resumo para o Zeus ler —
nunca a VPS ganhar a chave.

### 5.6 🟢 A cara e a voz dele (decisões do Paulo, 18/09/2026)

**A saudação da tela de entrada é dele, palavra por palavra.** Não mexer sem
ele pedir:

> *"Só darei acesso a todo meu conhecimento, se você provar que é o meu
> mestre... Digite a senha, caso contrário estará destinado ao fracasso,
> comece..."*

Ela aparece escrita na tela de entrada e é **falada no primeiro toque no
microfone** — que é o único momento em que pode ser: navegador nenhum deixa uma
página tocar áudio antes de alguém tocar nela.

**Ele fala como brasileiro fala.** O Paulo reclamou que ele dizia "vo-CÊ" com
peso na primeira sílaba. As duas coisas têm o mesmo conserto: no caminho até o
motor de voz, "você" vira "cê", "está" vira "tá", "para o" vira "pro". O texto
escrito (Pull Request, trilha, registro) continua formal — isso é fala, não
redação. Mora em `lib/pronuncia.js`, num bloco que dá para apagar inteiro se
soar forçado.

Dois cuidados travados por teste: *"isso não é meu"* nunca vira *"isso né meu"*
(o "né" só vale no fim da frase), e *"o robô **para** às seis"* nunca vira *"o
robô pras seis"* — o acento é o que separa o verbo da preposição.

### 5.7 🟡 A voz longa continua longa

O conserto do #10 encurta o tempo até a **primeira** palavra. O tempo total de
fala continua sendo o que é: numa máquina de um processador, quanto mais ele
fala, mais ele demora. Se depois de publicar ainda incomodar, o caminho é
encurtar a resposta dele (de "duas ou três frases" para "uma ou duas") — é uma
linha na instrução dele, e é decisão do Paulo, porque custa detalhe.

### 5.8 🟢 Limpeza

- Conferir se a falha dos dez minutos deixou algum ramo `zeus/…` ou Pull Request pela metade
  em `moviki-app`.

---

## 6. Como falar com o Paulo

Está no `CLAUDE.md` dos outros repositórios e vale aqui igual:

- Ele **não é programador**. Responder **sempre em português do Brasil**, direto, em tópicos curtos.
- **Nunca mostrar código na conversa.** Alterar o repositório e explicar o resultado em linguagem de negócio.
- A entrega é o Pull Request, não o código no chat.
- Se o pedido for ambíguo ou arriscado, perguntar antes.
- Se houver falha escondida ou caminho melhor, apontar antes de executar.
- Ele é direto e não tem paciência com rodeio: *"não precisa me explicar nada não, meu velho, vai resolvendo"*.
