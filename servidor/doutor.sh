#!/usr/bin/env bash
# servidor/doutor.sh  (repo: moviki-voice-interface)
#
# CONSULTA COMPLETA DO ZEUS. Diz o que esta errado E como consertar.
#
# POR QUE ISTO EXISTE — 18/09/2026
# O Zeus disse ao Paulo que "falta o token do GitHub" e acabou ali. Frase
# verdadeira e inutil: ele nao disse se o token nunca foi posto, se foi
# apagado, se venceu, ou se esta la mas sem permissao. Cada uma dessas tem um
# conserto diferente, e descobrir qual era exigia eu no meio.
#
# Aqui a maquina se examina sozinha. Cada linha vermelha vem com o comando que
# resolve.
#
#   cd /root/eikosistemas/moviki-voice-interface && bash servidor/doutor.sh

set -u

ENV_ARQ="${ZEUS_ENV_ARQ:-/etc/zeus/zeus.env}"
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DONO_GH="eikosistemas-pj"
REPOS=(moviki moviki-app moviki-ai moviki-assistente-social)

PROBLEMAS=0
ok()    { printf '  \033[32mok\033[0m    %s\n' "$1"; }
ruim()  { printf '  \033[31mFALHA\033[0m %s\n' "$1"; PROBLEMAS=$((PROBLEMAS+1)); }
aviso() { printf '  \033[33maviso\033[0m %s\n' "$1"; }
comoConsertar() { printf '        \033[36m-> %s\033[0m\n' "$1"; }
titulo() { printf '\n============================================================\n %s\n============================================================\n' "$1"; }

# ---------------------------------------------------------------------------
titulo "OS SEGREDOS"
# ---------------------------------------------------------------------------
if [ ! -f "$ENV_ARQ" ]; then
  ruim "o arquivo de segredos nao existe ($ENV_ARQ)"
  comoConsertar "SUDO_USER=root bash servidor/instalar.sh"
  echo
  echo "Sem esse arquivo nada mais faz sentido conferir. Pare aqui."
  exit 1
fi
ok "arquivo de segredos existe"

valorDe() { grep -E "^$1=" "$ENV_ARQ" 2>/dev/null | head -1 | cut -d= -f2- ; }

CHAVE="$(valorDe ANTHROPIC_API_KEY)"
SENHA="$(valorDe ZEUS_SENHA)"
GHTOKEN="$(valorDe ZEUS_GITHUB_TOKEN)"
MODELO="$(valorDe ZEUS_MODELO)"

[ -n "$CHAVE" ] && ok "chave da Anthropic presente" || {
  ruim "ANTHROPIC_API_KEY vazia — ele nao pensa"
  comoConsertar "SUDO_USER=root bash servidor/instalar.sh"
}

[ -n "$SENHA" ] && ok "senha do Zeus presente" || {
  ruim "ZEUS_SENHA vazia — a porta esta ABERTA e os olhos ficam fechados"
  comoConsertar "SUDO_USER=root bash servidor/instalar.sh"
}

if [ -z "$GHTOKEN" ]; then
  ruim "ZEUS_GITHUB_TOKEN VAZIO — e por isso que ele diz que nao tem acesso ao codigo"
  comoConsertar "bash servidor/token.sh    (poe so o token, sem mexer no resto)"
else
  ok "token do GitHub presente (${#GHTOKEN} caracteres)"
fi

if [ -n "$MODELO" ] && [ "$MODELO" != "claude-haiku-4-5" ]; then
  aviso "a conversa esta no modelo '$MODELO'"
  comoConsertar "o rapido responde em menos da metade do tempo: bash servidor/token.sh --modelo-rapido"
fi

# ---------------------------------------------------------------------------
titulo "O TOKEN DO GITHUB, TESTADO DE VERDADE"
# ---------------------------------------------------------------------------
# Token presente nao quer dizer token bom. Ele pode ter vencido, ter sido
# revogado, ou nunca ter recebido permissao nos repositorios certos — e os
# tres dao erros diferentes na hora de abrir o Pull Request, quando ja e
# tarde.
if [ -z "$GHTOKEN" ]; then
  aviso "sem token para testar"
else
  CODIGO="$(curl -sS -o /tmp/zeus-gh.json -w '%{http_code}' \
    -H "Authorization: Bearer $GHTOKEN" \
    -H "Accept: application/vnd.github+json" \
    https://api.github.com/user 2>/dev/null || echo "000")"

  case "$CODIGO" in
    200)
      QUEM="$(grep -o '"login"[^,]*' /tmp/zeus-gh.json | head -1 | cut -d'"' -f4)"
      ok "o GitHub reconhece o token (conta: $QUEM)"
      ;;
    401)
      ruim "o GitHub RECUSOU o token: venceu ou foi revogado"
      comoConsertar "crie outro em github.com > Settings > Developer settings > Personal access tokens > Fine-grained, e rode: bash servidor/token.sh"
      ;;
    000)
      ruim "nao consegui falar com o GitHub (rede?)"
      ;;
    *)
      ruim "o GitHub respondeu $CODIGO ao testar o token"
      ;;
  esac

  if [ "$CODIGO" = "200" ]; then
    for r in "${REPOS[@]}"; do
      C="$(curl -sS -o /dev/null -w '%{http_code}' \
        -H "Authorization: Bearer $GHTOKEN" \
        -H "Accept: application/vnd.github+json" \
        "https://api.github.com/repos/$DONO_GH/$r" 2>/dev/null || echo "000")"
      if [ "$C" = "200" ]; then
        ok "alcanca $r"
      else
        ruim "NAO alcanca $r (respondeu $C)"
        comoConsertar "no token, em Repository access, inclua $r com Contents e Pull requests = Read and write"
      fi
    done
  fi
fi
rm -f /tmp/zeus-gh.json

# ---------------------------------------------------------------------------
titulo "O ESPELHO — de onde ele LE o codigo"
# ---------------------------------------------------------------------------
ESPELHO="${ZEUS_ESPELHO:-/root/eikosistemas}"
for r in "${REPOS[@]}"; do
  if [ -d "$ESPELHO/$r/.git" ]; then
    ATRASO="$(cd "$ESPELHO/$r" && git log -1 --format=%cr 2>/dev/null || echo '?')"
    ok "$r no espelho (ultimo commit: $ATRASO)"
  else
    ruim "$r NAO esta no espelho — ele nao consegue ler nem analisar esse repositorio"
    comoConsertar "git clone https://github.com/$DONO_GH/$r $ESPELHO/$r"
  fi
done

# ---------------------------------------------------------------------------
titulo "OS SERVICOS"
# ---------------------------------------------------------------------------
for s in zeus-cerebro zeus-voz; do
  if systemctl is-active --quiet "$s" 2>/dev/null; then
    ok "$s de pe"
  else
    ruim "$s NAO esta de pe"
    comoConsertar "systemctl restart $s && journalctl -u $s -n 30 --no-pager"
  fi
done

if curl -sS -m 5 http://127.0.0.1:8124/api/zeus/vivo 2>/dev/null | grep -q '"ok"'; then
  ok "o cerebro responde"
else
  ruim "o cerebro nao responde na porta 8124"
  comoConsertar "journalctl -u zeus-cerebro -n 40 --no-pager"
fi

# ---------------------------------------------------------------------------
titulo "O QUE ELE ACHA QUE ESTA FAZENDO"
# ---------------------------------------------------------------------------
# Tarefa presa em "trabalhando" era o que fazia ele dizer "esta em andamento"
# por horas. Ao subir, o servidor enterra as orfas — mas se aparecer alguma
# aqui, ela e recente e de verdade.
EST="$RAIZ/dados/estado.json"
if [ -f "$EST" ]; then
  PRESAS="$(grep -c '"trabalhando"' "$EST" 2>/dev/null || echo 0)"
  if [ "$PRESAS" -gt 0 ]; then
    aviso "$PRESAS tarefa(s) em andamento agora"
    comoConsertar "se passar de 12 minutos, a ronda enterra sozinha e ele te conta"
  else
    ok "nenhuma tarefa presa"
  fi
else
  aviso "ainda nao existe memoria gravada (ele nunca rodou?)"
fi

# ---------------------------------------------------------------------------
titulo "RESULTADO"
# ---------------------------------------------------------------------------
if [ "$PROBLEMAS" -eq 0 ]; then
  echo "  Nada quebrado. Se ele ainda estiver estranho, me diga o que ele falou."
else
  echo "  $PROBLEMAS problema(s). As linhas azuis acima sao os comandos que resolvem."
fi
echo
