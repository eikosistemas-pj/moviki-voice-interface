#!/usr/bin/env bash
# servidor/token.sh  (repo: moviki-voice-interface)
#
# TROCA UMA COISA SO NO ARQUIVO DE SEGREDOS, SEM ENCOSTAR NO RESTO.
#
# POR QUE ISTO EXISTE — 18/09/2026
# O Zeus disse que nao tinha o token do GitHub. O unico jeito de por um token
# era rodar o `instalar.sh` inteiro — e ele REESCREVE o arquivo de segredos do
# zero, toda vez. Ou seja: para consertar uma linha, o Paulo tinha que
# responder de novo todas as perguntas, e qualquer deslize apagava a senha ou
# a chave da Anthropic.
#
# Foi provavelmente assim que o token sumiu: alguma rodada do instalador
# passou por ele com Enter, e ele foi gravado vazio por cima do que existia.
#
# Aqui e cirurgico: le o arquivo, troca UMA linha, grava de volta, confere o
# token contra o GitHub de verdade e reinicia o servico.
#
# USO
#   bash servidor/token.sh                   poe/troca o token do GitHub
#   bash servidor/token.sh --modelo-rapido   poe a conversa no modelo rapido
#   bash servidor/token.sh --ver             mostra o que esta configurado

set -euo pipefail

ENV_ARQ="${ZEUS_ENV_ARQ:-/etc/zeus/zeus.env}"
DONO_GH="eikosistemas-pj"
REPOS=(moviki moviki-app moviki-ai moviki-assistente-social)

if [ "$(id -u)" -ne 0 ]; then
  echo "Precisa ser root: sudo bash servidor/token.sh" >&2
  exit 1
fi

if [ ! -f "$ENV_ARQ" ]; then
  echo "Nao achei $ENV_ARQ. Rode primeiro: SUDO_USER=root bash servidor/instalar.sh" >&2
  exit 1
fi

valorDe() { grep -E "^$1=" "$ENV_ARQ" 2>/dev/null | head -1 | cut -d= -f2- ; }

# Troca (ou acrescenta) uma chave, preservando TUDO o mais — inclusive os
# comentarios, que explicam cada decisao e valem mais que o valor em si.
gravarChave() {
  local chave="$1" valor="$2"
  local tmp
  tmp="$(mktemp)"
  if grep -qE "^$chave=" "$ENV_ARQ"; then
    # `awk` e nao `sed`: o token pode conter barra e & , que o sed interpreta.
    awk -v k="$chave" -v v="$valor" \
      'BEGIN{FS=OFS="="} $1==k && !done {print k "=" v; done=1; next} {print}' \
      "$ENV_ARQ" > "$tmp"
  else
    cp "$ENV_ARQ" "$tmp"
    printf '%s=%s\n' "$chave" "$valor" >> "$tmp"
  fi
  # Copia de seguranca antes de trocar: um arquivo destes perdido custa uma
  # noite. Fica so-root, como o original.
  cp -p "$ENV_ARQ" "$ENV_ARQ.bak"
  cat "$tmp" > "$ENV_ARQ"
  rm -f "$tmp"
  chmod 600 "$ENV_ARQ" "$ENV_ARQ.bak"
}

# ---------------------------------------------------------------------------
if [ "${1:-}" = "--ver" ]; then
  echo "Em $ENV_ARQ:"
  for k in ANTHROPIC_API_KEY ZEUS_SENHA ZEUS_GITHUB_TOKEN ZEUS_MODELO ZEUS_CONFERE_VOZ; do
    v="$(valorDe "$k")"
    if [ -z "$v" ]; then
      printf '  %-20s (VAZIO)\n' "$k"
    elif [[ "$k" == *TOKEN* || "$k" == *KEY* || "$k" == *SENHA* ]]; then
      printf '  %-20s posto (%s caracteres)\n' "$k" "${#v}"
    else
      printf '  %-20s %s\n' "$k" "$v"
    fi
  done
  exit 0
fi

# ---------------------------------------------------------------------------
if [ "${1:-}" = "--modelo-rapido" ]; then
  gravarChave ZEUS_MODELO claude-haiku-4-5
  echo "[ok] a conversa passou para o modelo rapido."
  systemctl restart zeus-cerebro 2>/dev/null || true
  echo "[ok] zeus-cerebro reiniciado."
  exit 0
fi

# ---------------------------------------------------------------------------
# O token
# ---------------------------------------------------------------------------
cat <<'FIM'
Cole o token do GitHub. Ele nao aparece na tela enquanto voce digita — isso e
normal, pode colar e apertar Enter.

Se voce ainda nao tem um: github.com > Settings > Developer settings >
Personal access tokens > Fine-grained tokens > Generate new token

  Repository access .. SOMENTE moviki, moviki-app, moviki-ai e
                       moviki-assistente-social
  Contents ........... Read and write
  Pull requests ...... Read and write

Nada de administracao, nada de workflows, nada dos outros repositorios. Ele
so precisa PROPOR — quem junta na main e voce.

FIM

read -r -s -p "Token: " NOVO
echo
NOVO="$(printf '%s' "$NOVO" | tr -d '[:space:]')"

if [ -z "$NOVO" ]; then
  echo "Nada digitado. Nao mexi em nada." >&2
  exit 1
fi

# CONFERE ANTES DE GRAVAR. Gravar um token ruim so troca "nao tenho token" por
# "nao consegui abrir o Pull Request" — o mesmo vexame, mais tarde.
echo "Conferindo com o GitHub..."
CODIGO="$(curl -sS -o /tmp/zeus-tok.json -w '%{http_code}' \
  -H "Authorization: Bearer $NOVO" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/user 2>/dev/null || echo "000")"

if [ "$CODIGO" != "200" ]; then
  rm -f /tmp/zeus-tok.json
  echo
  echo "O GitHub recusou esse token (respondeu $CODIGO). NAO gravei nada." >&2
  [ "$CODIGO" = "401" ] && echo "401 quer dizer token invalido, vencido ou revogado." >&2
  exit 1
fi

QUEM="$(grep -o '"login"[^,]*' /tmp/zeus-tok.json | head -1 | cut -d'"' -f4)"
rm -f /tmp/zeus-tok.json
echo "[ok] o GitHub reconheceu o token (conta: $QUEM)"

FALTOU=0
for r in "${REPOS[@]}"; do
  C="$(curl -sS -o /dev/null -w '%{http_code}' \
    -H "Authorization: Bearer $NOVO" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/$DONO_GH/$r" 2>/dev/null || echo "000")"
  if [ "$C" = "200" ]; then
    echo "[ok] alcanca $r"
  else
    echo "[!!] NAO alcanca $r (respondeu $C)"
    FALTOU=1
  fi
done

if [ "$FALTOU" -eq 1 ]; then
  echo
  echo "Esse token nao alcanca todos os quatro repositorios."
  read -r -p "Gravar assim mesmo? (s/N) " AINDA
  if [[ "${AINDA,,}" != "s" ]]; then
    echo "Nao gravei nada. Ajuste o Repository access do token e rode de novo."
    exit 1
  fi
fi

gravarChave ZEUS_GITHUB_TOKEN "$NOVO"
echo "[ok] token guardado em $ENV_ARQ (o resto do arquivo ficou intacto)"
echo "[ok] copia do arquivo anterior em $ENV_ARQ.bak"

systemctl restart zeus-cerebro 2>/dev/null || true
sleep 2
if curl -sS -m 5 http://127.0.0.1:8124/api/zeus/vivo 2>/dev/null | grep -q '"ok"'; then
  echo "[ok] o Zeus subiu e esta respondendo."
else
  echo "[!!] o Zeus nao respondeu depois do restart:"
  echo "     journalctl -u zeus-cerebro -n 40 --no-pager"
fi

echo
echo "Pronto. Peca de novo a alteracao da cor do botao."
