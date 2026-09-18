# O cérebro do Zeus — como botar de pé na VPS

O Zeus tem duas metades na VPS:

| Parte | O que faz | Porta |
|---|---|---|
| `zeus-voz` (Kokoro) | transforma texto em voz | 8123 |
| `servidor/zeus.js` (este) | pensa, e guarda a trava do turno | 8124 |

A tela conversa com as duas pelo mesmo endereço, através do Nginx, para não
esbarrar em CORS.

## O jeito rápido: o instalador

Na VPS, dentro da pasta do repositório:

    sudo bash servidor/instalar.sh

Ele pergunta a chave da Anthropic (digitada, nunca aparece na tela), guarda em
`/etc/zeus/zeus.env` só legível pelo root, cria o serviço do systemd que sobe
sozinho depois de reiniciar, prepara a tela, refaz o build e confere se o
Zeus respondeu. No fim mostra a única linha que falta no Nginx.

Pode rodar de novo quando quiser — para trocar a chave, por exemplo.

O resto deste arquivo explica o que ele faz, para quando algo sair do lugar.

## As variáveis

Nunca em arquivo dentro do repositório. Na VPS, como variável de ambiente
(o mesmo lugar onde já vive a configuração do `zeus-voz`).

| Variável | Para que serve |
|---|---|
| `ANTHROPIC_API_KEY` | a chave da API. Sem ela o Zeus fica sem cérebro |
| `ZEUS_TOKEN` | senha simples que a tela manda junto. Ver o aviso abaixo |
| `ZEUS_LIMITE_DIA` | teto de falas por dia. Padrão 200 |
| `ZEUS_MODELO` | opcional. Padrão `claude-opus-5` |
| `ZEUS_ESTADO` | onde guardar a memória. Padrão `./dados/estado.json` |
| `ZEUS_PORTA` | padrão 8124 |
| `ZEUS_CONFERE_VOZ` | `1` (padrão) exige a voz do Paulo para abrir o turno. `0` desliga |
| `ZEUS_SENHA` | **a tranca.** Sem ela o Zeus atende de olhos fechados |
| `ZEUS_OLHOS` | `1` (padrão) lê o mapa e os repositórios. `0` desliga |
| `ZEUS_ESPELHO` | onde ficam os espelhos. Padrão `/root/eikosistemas` |
| `ZEUS_GITHUB_TOKEN` | **as mãos.** Sem ele o Zeus conversa mas não trabalha |
| `ZEUS_OFICINA` | onde ele monta o trabalho. Padrão `/root/eikosistemas/.oficina` |
| `ZEUS_MAX_VOLTAS` | quantas leituras antes de desistir. Padrão 12 |

### Sobre o `ZEUS_CONFERE_VOZ`

Com ele ligado, o turno só abre com a voz do Paulo reconhecida. Como o
conferidor de voz ainda não existe na VPS, ligado significa **o Zeus nunca
assume** — e para um robô que ainda está sendo moldado isso é paralisia, não
segurança.

O Paulo decidiu em 18/09/2026 deixar a conferência para depois e ver o Zeus
funcionando. O instalador escreve `0`. O risco, escrito com todas as letras:
**qualquer voz que diga a frase perto da tela assume o posto, inclusive uma
gravação.**

O que **não** afrouxa junto: a lista de assuntos que nunca são do robô continua
valendo igual. Mesmo assumindo sem prova, o Zeus não aprova Pull Request, não
mexe em preço e não encosta em dinheiro.

Toda abertura sem conferência fica marcada no turno e na trilha — daqui a três
meses, a pergunta "como esse turno foi aberto?" tem resposta.

Quando o conferidor existir, troque para `1`.

### A tranca (`ZEUS_SENHA`)

O `ZEUS_TOKEN` antigo **não era segurança**: viajava para dentro da página e
quem abrisse o código dela lia. Saiu de cena.

Agora a senha mora só no servidor e nunca vai para a tela. O Paulo digita uma
vez, o servidor confere e devolve um **crachá** que o navegador guarda. Os
pedidos seguintes levam o crachá, não a senha — senha roubada dá para sempre,
crachá roubado vence.

Cinco erros trancam **aquele endereço** por quinze minutos. O castigo é por
endereço, não geral: se fosse geral, bastaria alguém errar cinco vezes para
trancar o Paulo do lado de fora da própria casa.

Reiniciar o serviço derruba todos os crachás — e isso é desejável: depois de
mexer no Zeus, todo mundo entra de novo.

**O que a tranca não resolve:** sem HTTPS, a senha atravessa a rede em texto
aberto e quem estiver no caminho lê. A tranca só fica completa com o cadeado
do navegador. Enquanto isso, o teto diário (`ZEUS_LIMITE_DIA`) segura o
prejuízo se algo vazar.

### Os olhos (`ZEUS_OLHOS`)

A VPS guarda um espelho **só de leitura** dos seis repositórios públicos.
Dali saem o mapa mestre (`CLAUDE.md`, a memória oficial do projeto) e o
retrato de agora — em que ramo cada repositório está e o que entrou
ultimamente.

**Os olhos só abrem com a porta trancada.** Enquanto o Zeus sabia apenas o
folheto da empresa, porta fraca era aborrecimento pequeno; sabendo de tudo, a
mesma porta entrega a empresa inteira a quem descobrir o endereço. Sem
`ZEUS_SENHA` configurada o servidor sobe de olhos fechados e grita sobre isso.

O `moviki-vault` fica de fora: é o cofre do Obsidian, privado, e o Zeus fala
em voz alta — o que ele sabe, ele diz.

O espelho é atualizado a cada quinze minutos, **em segundo plano**. De
propósito não acontece na hora da pergunta: atualizar seis repositórios leva
dezenas de segundos e o Paulo está esperando resposta em voz alta.

**Custo:** o mapa tem umas sete mil palavras e vai no pedaço *cacheado* do
pedido — a Anthropic cobra cerca de um décimo por texto repetido que ela já
viu. O retrato, que muda, fica de fora do cache, mas é curto. O servidor
registra em cada resposta quantos tokens vieram do cache; se esse número zerar,
alguém mexeu no começo do prompt e a conta vai dobrar em silêncio.

## Subir

O servidor não tem dependência nenhuma — é Node puro. Basta ter Node 18 ou
mais novo (por causa do `fetch`).

    npm run zeus

Para ele ficar de pé sozinho e voltar depois de um reinício, use uma unit do
systemd, igual à do `zeus-voz`. Três coisas importam nela:

- rodar como usuário sem privilégio, não como root;
- `Restart=always`, para voltar sozinho;
- as variáveis acima em `Environment=` ou num `EnvironmentFile=` fora do git.

## Nginx

A tela chama `/api/voz` e `/api/zeus` no mesmo domínio. O Nginx encaminha:

    location /api/voz  { proxy_pass http://127.0.0.1:8123; }
    location /api/zeus { proxy_pass http://127.0.0.1:8124; }

O servidor escuta só em `127.0.0.1` de propósito: quem fala com o mundo é o
Nginx, na frente. Um servidor de comando não fica exposto direto na internet.

**O microfone exige HTTPS.** Por IP em HTTP puro o navegador bloqueia — é
regra de origem segura, não defeito.

## Conferir se está vivo

    curl http://127.0.0.1:8124/api/zeus/vivo

Deve responder `{"ok":true}`. Esse é o único endereço que responde sem crachá,
e de propósito ele não conta nada: saber que o turno está **aberto** é saber
que o Paulo não está olhando.

### As mãos (`ZEUS_GITHUB_TOKEN`)

**O Zeus propõe, nunca publica.** Ele trabalha num ramo `zeus/…` e abre Pull
Request; quem junta na main é o Paulo. A regra de ouro número 1 do Moviki é
nunca fazer push direto na main, porque o Vercel publica a main na hora para
os clientes — e um robô não é exceção.

O pior caso de um erro dele passa a ser **um Pull Request ruim esperando
aprovação**, não um site fora do ar.

**Onde ele pode encostar:** `moviki`, `moviki-app`, `moviki-ai` e
`moviki-assistente-social`.

Fora de alcance: **`moviki-robo`**, que é o robô do dinheiro — o mapa mestre
diz que ele muda o mínimo possível, de propósito. E **`moviki-voice-interface`**,
que é o próprio Zeus: ele não mexe em si mesmo nem na trava que o segura.

Mesmo nos permitidos, nunca: regras do Firestore e do Storage, `.github/`,
qualquer `.env`, `vercel.json`, o `CLAUDE.md` e o `package-lock.json`. Cada uma
dessas é uma porta que, aberta, deixaria contornar as outras travas sem
quebrar nenhuma.

**Como criar o token** (github.com → Settings → Developer settings → Personal
access tokens → Fine-grained):

- **Repository access:** somente os quatro repositórios acima
- **Contents:** Read and write
- **Pull requests:** Read and write
- Nada de administração, nada de workflows, nada dos outros repositórios

Sem o token o Zeus continua conversando; ele só avisa que não tem acesso para
mexer no código.

**Como o trabalho corre:** ler o código leva minutos e o Paulo está parado na
frente da tela esperando uma voz. Então ele diz "vou trabalhar nisso" na hora,
o trabalho corre por fora, e o resultado é contado na próxima vez que o Paulo
falar. Sem isso, ou o Paulo ouvia silêncio por dois minutos, ou descobria o
Pull Request dias depois sem lembrar de ter pedido.

**Como ele sabe onde mexer:** pelo que o Paulo fala. "O painel do lojista" é
`moviki-app`, "o site" é `moviki`, "o atendente" é `moviki-ai`, "o Instagram" é
`moviki-assistente-social`. Se não der para saber, ele pergunta em vez de
chutar.

### A demora, e o que foi feito com ela

O Paulo reclamou do tempo entre falar e ouvir. Ele vinha de dois lugares, e os
dois foram atacados em 18/09/2026:

**O modelo.** A conversa passou para `claude-haiku-4-5`. Com o mapa mestre no
prompt, a diferença de qualidade numa resposta de três frases é pequena, e a
de tempo é enorme. O modelo forte ficou onde importa — em `trabalho.js`, que
lê código e escreve alteração. Quem quiser o forte também na conversa troca
`ZEUS_MODELO` na VPS.

**A voz.** O Kokoro só devolve o áudio quando termina a resposta inteira, e a
máquina tem um processador só: quatro frases levam quatro vezes mais que uma,
e nesse tempo todo o Zeus fica mudo. Agora a resposta é partida em pedaços e
cada um é sintetizado **enquanto o anterior toca**. O tempo até a última
palavra é quase o mesmo; o tempo até a primeira cai para uma fração — e é esse
que a pessoa chama de "demora".

Um de cada vez, de propósito: com um processador só, mandar todos os pedidos
juntos faz os pedaços brigarem pela mesma CPU e todos chegarem mais tarde.

O registro agora mostra quanto ele demorou pensando em cada resposta. Sem
medir, "está lento" vira discussão de opinião.

### O aviso quando termina

O trabalho corre por fora da conversa. Sem aviso, o Paulo teria que ficar
espiando o repositório, ou descobriria o Pull Request muito depois.

A tela pergunta ao servidor, de doze em doze segundos, se há novidade —
**o servidor não empurra**, porque navegador não tem campainha e montar um cano
aberto só para isso seria peso a mais numa máquina de 2 GB. A rota não pensa
nem gasta chamada paga: devolve o que já estava guardado.

**Ele não corta a fala de ninguém:** só avisa com o microfone fechado e com ele
calado. E a frase é montada no servidor, não pelo cérebro — avisar não é
pensar, e passar pelo modelo custaria dinheiro e segundos para dizer uma frase
que já se sabe qual é.

O link não é falado: soletrar endereço em voz alta é tortura. Ele volta na
resposta escrita.

### A ronda — ele chamando você por conta própria

O aviso conta o que o Zeus **fez**. A ronda conta o que ele **percebeu** —
coisa que ninguém pediu para ele olhar. É a diferença entre um funcionário que
entrega o que foi mandado e um que bate na porta para avisar que tem fumaça
saindo da cozinha.

De cinco em cinco minutos ele confere quatro coisas e, havendo o que dizer,
chama você pelo nome na primeira brecha em que você não estiver falando:

| O que ele percebe | Por que importa |
|---|---|
| A voz caiu | Ele pensa mas não fala, e você só descobriria ao tentar conversar |
| A máquina apertando de memória | Já aconteceu nesta VPS: sem memória o sistema mata programas, e a voz é a primeira a morrer |
| Pull Request parado há mais de 6 horas | Enquanto você não aprova, o trabalho não está no ar — e ninguém mais vai lembrar |
| O teto de falas do dia chegando | Emudecer sem avisar deixaria você achando que quebrou |

**O perigo aqui é o excesso, não a falta.** Assistente que fala demais é
desligado na primeira semana — e aí não avisa nem o que importava. Três regras
duras, todas travadas por teste:

1. **Cada assunto fala uma vez.** Enquanto a situação não mudar, ele cala por
   seis horas.
2. **Tem descanso entre avisos.** Mesmo com três coisas erradas ao mesmo
   tempo, ele conta uma e espera dez minutos.
3. **Só o que você pode resolver.** "A memória está em 61%" não é aviso, é
   ruído.

Nada disso passa pelo cérebro: perceber não é pensar. São contas que a máquina
faz de graça e na hora, e as frases já se sabe quais são.

## O botão de pânico

O Zeus nunca pode se trancar por dentro. A garantia não depende dele:

    sudo bash servidor/parar.sh

Isso derruba o serviço e força o turno a fechar no arquivo de estado, sem
passar pelo Zeus. Funciona mesmo que ele esteja travado, mudo ou respondendo
besteira.

Na mão, se preferir:

    sudo systemctl stop zeus-cerebro

A VPS é sua. O serviço roda com usuário sem privilégio, e o Zeus não tem
como escrever no próprio código, no serviço do systemd nem no arquivo de
segredos — ele só fala.

**Ele também não mexe em si mesmo por ordem falada.** "Muda a trava", "altera
o seu código", "desliga o zeus-cerebro" caem na lista dos assuntos que nunca
são do robô, com turno aberto ou fechado. Chamar ele pelo nome não conta:
"Zeus, muda o texto da página" é ordem normal, e ele obedece.

## O microfone é seu

O Zeus **não aciona o microfone**. Existe um único ponto no código que liga a
escuta, e é o botão na tela. Não há escuta contínua, não há palavra de
despertar, e a escuta morre sozinha no fim da frase.

A "melhoria" que alguém vai querer fazer um dia — reabrir a escuta sozinho
quando o Zeus terminar de falar — é justamente a que não pode ser feita.

## A memória

Fica em `dados/estado.json`, na própria VPS. Guarda o turno, a trilha do que o
Zeus fez enquanto você esteve fora, o uso do dia e as últimas falas.

**Não vai para o Firestore de propósito.** Escrever lá exigiria levar a chave
de service account para dentro da VPS — a mesma chave que alcança dinheiro,
assinatura e cadastro de todo lojista. Trocar um arquivo local por espalhar a
chave mestra num servidor novo é mau negócio. O Zeus é o posto de comando do
Paulo, não parte do produto: o estado dele fica em casa.

A pasta `dados/` está fora do git. Ela guarda conversa sua, e conversa sua não
vira commit.
