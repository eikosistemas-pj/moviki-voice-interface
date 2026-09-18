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
