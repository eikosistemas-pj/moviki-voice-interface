# ESTADO DO ZEUS — 18/09/2026

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

**Custo:** a conversa roda no modelo barato (Haiku), o trabalho de código no modelo forte (Opus).
O mapa mestre viaja no bloco com desconto de cache — quem repete a mesma base paga menos.
Tem teto diário de chamadas: se o endereço vazar, o prejuízo para no teto em vez de crescer a noite toda.

---

## 4. ⚠️ O PONTO EXATO ONDE PARAMOS

**O Paulo reclamou: "Delay enorme ainda". A causa foi encontrada e é esta:**

O conserto da lentidão **existe, está testado, e nunca chegou ao ar.**

- O conserto é o commit `4075c93`.
- Ele foi enviado para o ramo **depois** que o Pull Request #8 já tinha sido aprovado e fechado.
- Pull Request fechado não carrega mais nada. Então o conserto ficou parado no ramo, fora da `main`.
- Por isso o `git pull` na VPS nunca trouxe ele. **O Zeus está rodando o código lento até agora.**

### Qual era a lentidão

Erro de projeto meu, não do modelo nem da máquina de 2 GB.

Eu mandava o Zeus **ler o arquivo inteiro e devolver o arquivo inteiro**. Só que:

| Arquivo | Tamanho |
|---|---|
| `moviki-app/index.html` | 568.633 caracteres |
| `moviki-app/parceiro.html` | 327.492 |
| `moviki/404.html` | 264.808 |

Nenhum modelo devolve meio milhão de caracteres numa resposta. Ele lia um pedaço cortado,
tentava reescrever o todo, batia no teto e recomeçava — **dez minutos queimando dinheiro contra uma parede**,
para trocar a cor de um botão.

### O conserto

Ele agora **procura** o trecho, **lê só uma janela** em volta dele, e **troca só aquele pedaço**.
Trocar uma cor passou a custar algumas dezenas de caracteres em vez de meio milhão.
De quebra ficou mais seguro: quem troca um pedaço não apaga o resto do arquivo sem querer.

Se ele errar o trecho, o próprio sistema devolve o erro para ele e ele se corrige sozinho,
em vez de propor uma alteração que não encaixa.

**126 testes passando, lint limpo, build ok.**

### O que o Paulo precisa fazer

1. Aprovar o Pull Request **#9** (é só esse conserto + este arquivo).
2. Rodar na VPS o bloco de publicar da seção 2.
3. Pedir de novo a troca de cor de um botão e cronometrar.

Depois disso dá para medir de verdade — o registro passou a dizer em quantos segundos e em
quantas idas e vindas ele terminou:

```
journalctl -u zeus-cerebro -n 30 --no-pager | grep -i "trabalho\|pensou"
```

- `[zeus] pensou em Xs` → demora de **conversa**
- `[zeus] trabalho pronto em Xs, N idas e vindas` → demora de **trabalho de código**

São dois problemas diferentes e o conserto só ataca o segundo. Se a conversa ainda estiver
lenta depois disso, o caminho é outro (fila de voz e tamanho da resposta falada).

---

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

### 5.6 🟢 Limpeza

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
