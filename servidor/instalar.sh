#!/usr/bin/env bash
#
# instalar.sh — bota o cerebro do Zeus de pe na VPS, de uma vez.
#
# Roda a partir da raiz do repositorio:   sudo bash servidor/instalar.sh
#
# O que ele faz:
#   1. pergunta a chave da Anthropic (digitada, nunca colada em arquivo aqui)
#   2. guarda a chave em /etc/zeus/zeus.env, so legivel pelo root
#   3. cria o servico do systemd, que sobe sozinho depois de reiniciar
#   4. prepara a tela para falar com o cerebro e refaz o build
#   5. mostra as duas linhas do Nginx que faltam
#
# Ele pode ser rodado de novo sem medo: refaz o que mudou e mantem o resto.

set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_DIR=/etc/zeus
ENV_ARQ="$ENV_DIR/zeus.env"
UNIT=/etc/systemd/system/zeus-cerebro.service

if [ "$(id -u)" -ne 0 ]; then
  echo "Rode com sudo:  sudo bash servidor/instalar.sh" >&2
  exit 1
fi

# Sob quem o servico roda. Nunca root: um servidor de comando com poder de
# root e um estrago a mais em qualquer descuido.
DONO="${SUDO_USER:-$(logname 2>/dev/null || echo zeus)}"

echo
echo "=== Cerebro do Zeus ==="
echo "Repositorio: $RAIZ"
echo "Servico vai rodar como: $DONO"
echo

# ---------------------------------------------------------------------------
# 1. A chave
# ---------------------------------------------------------------------------
CHAVE_ATUAL=""
if [ -f "$ENV_ARQ" ]; then
  CHAVE_ATUAL="$(grep -E '^ANTHROPIC_API_KEY=' "$ENV_ARQ" | cut -d= -f2- || true)"
fi

if [ -n "$CHAVE_ATUAL" ]; then
  echo "Ja existe uma chave da Anthropic guardada."
  read -r -p "Trocar por outra? (s/N) " TROCAR
  if [[ "${TROCAR,,}" != "s" ]]; then
    CHAVE="$CHAVE_ATUAL"
  fi
fi

if [ -z "${CHAVE:-}" ]; then
  echo
  echo "Cole a chave da Anthropic (ela NAO aparece na tela enquanto voce digita):"
  read -r -s CHAVE
  echo
  if [ -z "$CHAVE" ]; then
    echo "Sem chave o Zeus fica sem cerebro. Abortado." >&2
    exit 1
  fi
fi

# ---------------------------------------------------------------------------
# 2. A SENHA da porta
# ---------------------------------------------------------------------------
# Esta e a tranca de verdade. Ela mora so aqui e NUNCA vai para a tela — ao
# contrario do ZEUS_TOKEN antigo, que viajava para dentro da pagina e quem
# abrisse o codigo dela lia.
#
# Importa porque o Zeus agora tem olhos: ele le o mapa mestre e o estado dos
# repositorios. Sem senha ele atende de olhos fechados, e o servidor grita
# sobre isso ao subir.
SENHA=""
if [ -f "$ENV_ARQ" ]; then
  SENHA="$(grep -E '^ZEUS_SENHA=' "$ENV_ARQ" | cut -d= -f2- || true)"
fi

if [ -n "$SENHA" ]; then
  echo "Ja existe uma senha do Zeus."
  read -r -p "Trocar por outra? (s/N) " TROCAR_SENHA
  if [[ "${TROCAR_SENHA,,}" == "s" ]]; then SENHA=""; fi
fi

if [ -z "$SENHA" ]; then
  echo
  echo "Crie uma SENHA para falar com o Zeus (nao aparece na tela):"
  read -r -s SENHA
  echo
  echo "Repita:"
  read -r -s SENHA2
  echo
  if [ "$SENHA" != "$SENHA2" ]; then
    echo "As duas nao batem. Abortado." >&2
    exit 1
  fi
  if [ ${#SENHA} -lt 6 ]; then
    echo "Muito curta. Use pelo menos 6 caracteres. Abortado." >&2
    exit 1
  fi
fi

# ---------------------------------------------------------------------------
# 2b. O token do GitHub — sem ele o Zeus conversa mas nao TRABALHA
# ---------------------------------------------------------------------------
# E com ele que o Zeus abre Pull Request. Ele nunca junta na main: quem aprova
# e o Paulo. Por isso o token pode (e deve) ser estreito.
#
# Como criar, em github.com > Settings > Developer settings >
# Personal access tokens > Fine-grained tokens:
#   Repository access: SOMENTE moviki, moviki-app, moviki-ai e
#                      moviki-assistente-social
#   Permissoes:        Contents = Read and write
#                      Pull requests = Read and write
#   Nada de administracao, nada de workflows, nada dos outros repositorios.
GHTOKEN=""
if [ -f "$ENV_ARQ" ]; then
  GHTOKEN="$(grep -E '^ZEUS_GITHUB_TOKEN=' "$ENV_ARQ" | cut -d= -f2- || true)"
fi

if [ -n "$GHTOKEN" ]; then
  echo "Ja existe um token do GitHub guardado."
  read -r -p "Trocar por outro? (s/N) " TROCAR_GH
  if [[ "${TROCAR_GH,,}" == "s" ]]; then GHTOKEN=""; fi
fi

if [ -z "$GHTOKEN" ]; then
  echo
  echo "Cole o token do GitHub para o Zeus abrir Pull Request."
  echo "Deixe VAZIO e aperte Enter para ele so conversar, sem trabalhar:"
  read -r -s GHTOKEN
  echo
fi

# ---------------------------------------------------------------------------
# 3. Grava o ambiente
# ---------------------------------------------------------------------------
mkdir -p "$ENV_DIR"
umask 077

# ---------------------------------------------------------------------------
# ESTE ARQUIVO REESCREVIA TUDO DO ZERO. FOI ASSIM QUE O TOKEN SUMIU.
# ---------------------------------------------------------------------------
# 18/09/2026: o Zeus disse ao Paulo que nao tinha o token do GitHub — um token
# que ja tinha sido posto. A causa mais provavel: alguma rodada deste
# instalador passou pela pergunta do token com um Enter, e gravou VAZIO por
# cima do que existia.
#
# Reescrever tudo a cada rodada transforma "quero trocar uma coisa" em "tenho
# que responder tudo de novo sem errar nenhuma". Agora o que ja estava la e
# preservado quando a resposta vem vazia. E existe servidor/token.sh para
# trocar UMA coisa sem passar por aqui.
guardado() { [ -f "$ENV_ARQ" ] && grep -E "^$1=" "$ENV_ARQ" 2>/dev/null | head -1 | cut -d= -f2- || true; }

# Se a pergunta ficou em branco mas ja havia valor, o valor antigo fica.
[ -z "${CHAVE:-}" ]   && CHAVE="$(guardado ANTHROPIC_API_KEY)"
[ -z "${SENHA:-}" ]   && SENHA="$(guardado ZEUS_SENHA)"
[ -z "${GHTOKEN:-}" ] && GHTOKEN="$(guardado ZEUS_GITHUB_TOKEN)"
MODELO_ANTIGO="$(guardado ZEUS_MODELO)"
MODELO="${MODELO_ANTIGO:-claude-haiku-4-5}"

if [ -f "$ENV_ARQ" ]; then
  cp -p "$ENV_ARQ" "$ENV_ARQ.bak"
  chmod 600 "$ENV_ARQ.bak"
  echo "[ok] copia do arquivo anterior em $ENV_ARQ.bak"
fi

cat > "$ENV_ARQ" <<FIM
# Segredos do cerebro do Zeus. NUNCA vai para o git.
ANTHROPIC_API_KEY=$CHAVE

# A tranca. Mora so aqui; a tela nunca ve.
ZEUS_SENHA=$SENHA

# Olhos: le o mapa mestre e o estado dos repositorios. So abrem com a senha
# acima configurada — sem ela o servidor atende de olhos fechados.
ZEUS_OLHOS=1

# Maos: sem este token ele conversa mas nao abre Pull Request.
ZEUS_GITHUB_TOKEN=$GHTOKEN

# Teto de falas por dia. Porta na internet nao tem fundo: se o endereco
# vazar, a conta para aqui em vez de crescer a noite inteira.
ZEUS_LIMITE_DIA=200

# Modelo da CONVERSA. Rapido de proposito: conversa e medida em segundos de
# espera, e o Paulo esta na frente da tela ouvindo. O modelo FORTE continua
# onde importa — lendo codigo e escrevendo alteracao (servidor/trabalho.js) e
# olhando o codigo para responder (servidor/analise.js), que correm por fora
# da conversa e nao deixam ninguem esperando.
#
# ESTA LINHA JA ESTEVE ERRADA: gravava claude-opus-5 e anulava em silencio a
# decisao de por a conversa no rapido. O registro mostrava 3,3s a 4,0s por
# resposta por causa disso.
ZEUS_MODELO=$MODELO

# CONFERENCIA DE VOZ DESLIGADA — decisao do Paulo em 18/09/2026.
# Com 0, a frase falada basta para o Zeus assumir o posto. Qualquer voz que
# diga a frase perto da tela assume, inclusive uma gravacao.
# Quando o conferidor de voz existir, troque para 1.
ZEUS_CONFERE_VOZ=0

ZEUS_ESTADO=$RAIZ/dados/estado.json
ZEUS_PORTA=8124
FIM
chmod 600 "$ENV_ARQ"
echo "[ok] segredos em $ENV_ARQ (so o root le)"

mkdir -p "$RAIZ/dados"
chown -R "$DONO" "$RAIZ/dados"

# ---------------------------------------------------------------------------
# 4. O servico
# ---------------------------------------------------------------------------
NODE_BIN="$(command -v node || true)"
if [ -z "$NODE_BIN" ]; then
  echo "Node nao encontrado. Instale o Node 18 ou mais novo e rode de novo." >&2
  exit 1
fi

cat > "$UNIT" <<FIM
[Unit]
Description=Cerebro do Zeus (Moviki)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$DONO
WorkingDirectory=$RAIZ
EnvironmentFile=$ENV_ARQ
ExecStart=$NODE_BIN servidor/zeus.js
Restart=always
RestartSec=3
# Ele so precisa escrever na pasta dados/. O resto do disco fica so-leitura.
ProtectSystem=full
PrivateTmp=true
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
FIM

systemctl daemon-reload
systemctl enable --now zeus-cerebro >/dev/null 2>&1 || systemctl restart zeus-cerebro
echo "[ok] servico zeus-cerebro de pe"

# ---------------------------------------------------------------------------
# 5. A tela
# ---------------------------------------------------------------------------
# A tela nao guarda segredo nenhum: ela pede a senha ao Paulo e recebe um
# cracha do servidor. Por isso aqui so ficam enderecos.
cat > "$RAIZ/.env.local" <<FIM
VITE_ZEUS_TTS_ENDPOINT=/api/voz
VITE_ZEUS_ENDPOINT=/api/zeus
FIM
chown "$DONO" "$RAIZ/.env.local"
echo "[ok] .env.local escrito (fora do git)"

if [ -d "$RAIZ/node_modules" ]; then
  echo "Refazendo o build da tela..."
  sudo -u "$DONO" bash -lc "cd '$RAIZ' && npm run build" >/dev/null
  echo "[ok] build refeito em dist/"
else
  echo "[!] node_modules ausente. Rode 'npm install && npm run build' como $DONO."
fi

# ---------------------------------------------------------------------------
# 6. Conferencia
# ---------------------------------------------------------------------------
sleep 2
echo
if curl -fsS http://127.0.0.1:8124/api/zeus/vivo >/dev/null 2>&1; then
  echo "[ok] o cerebro respondeu."
else
  echo "[!] o cerebro nao respondeu. Veja o que houve com:"
  echo "    journalctl -u zeus-cerebro -n 30 --no-pager"
fi

cat <<FIM


No bloco do site do Zeus, ao lado do /api/voz que ja existe, acrescente:

    location /api/zeus { proxy_pass http://127.0.0.1:8124; }

Depois:  sudo nginx -t && sudo systemctl reload nginx

Lembre que o microfone so funciona em HTTPS ou em localhost — por IP em HTTP
puro o navegador bloqueia, e isso e regra do navegador, nao defeito.

=== Comandos que voce vai usar ===

  sudo systemctl restart zeus-cerebro     reiniciar (derruba os crachas)
  journalctl -u zeus-cerebro -f           ver o que ele esta fazendo
  sudo bash servidor/instalar.sh          rodar de novo (trocar chave, etc.)

FIM
