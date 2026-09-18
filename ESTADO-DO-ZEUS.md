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
| #10 | **A demora atacada de verdade** — ver seção 4 |

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

### 4.4 A pergunta do Paulo: "a máquina aguenta?"

**Resposta honesta: só o pedaço 3 da tabela acima depende da máquina — e é o
único que roda num processador só.** O cérebro é chamada de API (não usa a CPU
da VPS) e o resto é código.

Não dá para responder "aguenta ou não" no chute, então entrou um medidor:

```
cd /root/eikosistemas/moviki-voice-interface && bash servidor/medir.sh
```

Ele mede o tempo do Kokoro para uma frase curta — que é exatamente o tempo até
o Zeus abrir a boca — e diz como ler o número:

| Frase curta leva | Significa |
|---|---|
| menos de 1,5s | a máquina dá conta; demora que sobrar é de código |
| 1,5s a 3s | apertado, dá para conviver, mas não é "toma lá dá cá" |
| mais de 3s | **a máquina é o gargalo** — nenhum conserto de código tira isso |

Se cair no terceiro caso, os caminhos são dois: **mais processadores**
(CPX22 ou CPX32, é troca de plano na Hetzner, não é reinstalar tudo) ou **tirar
a voz da VPS**. O script também mostra a "CPU roubada": acima de 5% quer dizer
que a Hetzner está dividindo o processador com outro cliente, e aí nem trocar
código nem trocar plano resolve sozinho.

**Rodar esse script é o próximo passo depois de publicar.** Sem ele, a decisão
de trocar de máquina seria dinheiro gasto no palpite.

## 5. Pendências — em ordem de importância

### 5.1 🔴 Trocar a chave da Anthropic (do Paulo, urgente)

A chave apareceu numa captura de tela durante a montagem. **Precisa ser trocada.**
Em `console.anthropic.com`. **A ordem importa, senão o atendente do WhatsApp emudece:**

1. Cria a chave nova do Zeus → põe em `/etc/zeus/zeus.env` na VPS → reinicia o `zeus-cerebro`
2. Cria a chave nova do `moviki-ai` → põe nas Environment Variables do Vercel → publica
3. **Só depois** apaga a chave velha

### 5.2 🔴 HTTPS

Hoje a senha de entrada do Zeus atravessa a internet aberta, e o microfone do navegador
só é liberado direito em endereço seguro. Falta um subdomínio (ex.: `zeus.moviki.com.br`)
e o certificado.

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

### 5.6 🟡 A voz longa continua longa

O conserto do #10 encurta o tempo até a **primeira** palavra. O tempo total de
fala continua sendo o que é: numa máquina de um processador, quanto mais ele
fala, mais ele demora. Se depois de publicar ainda incomodar, o caminho é
encurtar a resposta dele (de "duas ou três frases" para "uma ou duas") — é uma
linha na instrução dele, e é decisão do Paulo, porque custa detalhe.

### 5.7 🟢 Limpeza

- O texto final do instalador ainda diz "Falta só o Nginx", que confunde — tirar.
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
