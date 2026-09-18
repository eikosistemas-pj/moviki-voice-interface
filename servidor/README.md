# O cérebro do Zeus — como botar de pé na VPS

O Zeus tem duas metades na VPS:

| Parte | O que faz | Porta |
|---|---|---|
| `zeus-voz` (Kokoro) | transforma texto em voz | 8123 |
| `servidor/zeus.js` (este) | pensa, e guarda a trava do turno | 8124 |

A tela conversa com as duas pelo mesmo endereço, através do Nginx, para não
esbarrar em CORS.

## Antes de tudo: as variáveis

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
