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

**O `ZEUS_TOKEN` não é segurança.** Ele viaja para o navegador e qualquer um
lê no código da página. Serve para o endereço não ficar aberto de brincadeira
na internet. Quem segura o prejuízo de verdade é o `ZEUS_LIMITE_DIA`: se o
token vazar, a conta para no teto em vez de crescer a noite inteira. Para
fechar de verdade, ponha senha no Nginx ou libere só o seu IP.

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

    curl http://127.0.0.1:8124/api/zeus/turno

Deve responder com o estado do turno. Se responder `aberto: false`, está certo
— o turno nasce fechado.

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
