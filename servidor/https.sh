#!/usr/bin/env bash
# servidor/https.sh  (repo: moviki-voice-interface)
#
# PoE O ZEUS NUM ENDERECO SEGURO. E O QUE DESTRAVA O MICROFONE NO CELULAR.
#
# ---------------------------------------------------------------------------
# POR QUE O MICROFONE NAO ABRE NO CELULAR — 18/09/2026
# ---------------------------------------------------------------------------
# Nao e defeito do Zeus nem do celular. E regra de navegador, e vale para
# todos: microfone e reconhecimento de fala SO funcionam em endereco seguro
# (https) ou em `localhost`.
#
# Hoje o Zeus mora num endereco de numero, sem cadeado. No computador do Paulo
# ele ainda funciona em alguns casos; no celular, nunca — o navegador nem
# pergunta, so nao deixa.
#
# E tem a outra metade, que e pior: HOJE A SENHA DELE ATRAVESSA A INTERNET
# ABERTA. Qualquer um no caminho le. O cadeado conserta as duas coisas de uma
# vez.
#
# ---------------------------------------------------------------------------
# O QUE O PAULO PRECISA FAZER ANTES (uma vez so, e nao e aqui)
# ---------------------------------------------------------------------------
# Criar um subdominio apontando para esta VPS. No painel do dominio:
#
#     Tipo: A     Nome: zeus     Valor: 204.168.204.48
#
# Isso vira `zeus.moviki.com.br`. Leva de minutos a algumas horas para valer
# no mundo todo. Depois, aqui na VPS:
#
#     bash servidor/https.sh zeus.moviki.com.br
#
# O resto e por conta deste arquivo.

set -euo pipefail

DOMINIO="${1:-}"
EMAIL="${ZEUS_EMAIL_CERT:-eikosistemas@gmail.com}"

if [ -z "$DOMINIO" ]; then
  echo "Falta o endereco. Exemplo:" >&2
  echo "  bash servidor/https.sh zeus.moviki.com.br" >&2
  exit 1
fi

if [ "$(id -u)" -ne 0 ]; then
  echo "Precisa ser root: sudo bash servidor/https.sh $DOMINIO" >&2
  exit 1
fi

echo "============================================================"
echo " 1. O endereco aponta para esta maquina?"
echo "============================================================"
# Conferir ANTES de pedir o certificado. A Let's Encrypt limita quantas vezes
# se pode errar por semana — queimar tentativa por causa de DNS que ainda nao
# propagou custa dias de espera.
MEU_IP="$(curl -sS -m 10 https://api.ipify.org 2>/dev/null || echo '')"
DO_DOMINIO="$(getent ahostsv4 "$DOMINIO" 2>/dev/null | awk '{print $1; exit}' || echo '')"

echo "  esta maquina .... ${MEU_IP:-nao consegui descobrir}"
echo "  $DOMINIO .... ${DO_DOMINIO:-nao resolve ainda}"

if [ -z "$DO_DOMINIO" ]; then
  echo
  echo "Esse endereco ainda nao resolve. Crie o registro A apontando para" >&2
  echo "esta maquina e espere propagar. Nao adianta insistir agora." >&2
  exit 1
fi

if [ -n "$MEU_IP" ] && [ "$DO_DOMINIO" != "$MEU_IP" ]; then
  echo
  echo "O endereco aponta para OUTRA maquina ($DO_DOMINIO)." >&2
  echo "Corrija o registro A antes de continuar." >&2
  exit 1
fi
echo "  [ok] aponta para ca"

echo
echo "============================================================"
echo " 2. Onde a tela do Zeus esta atendendo"
echo "============================================================"
# O PM2 pode subir a tela em portas diferentes conforme o modo. Descobrir e
# melhor que chutar: porta errada aqui da tela branca com cadeado, que e pior
# que nao ter cadeado.
PORTA_TELA=""
for p in 4173 5173 3000 8080; do
  if curl -sS -m 3 -o /dev/null "http://127.0.0.1:$p" 2>/dev/null; then
    PORTA_TELA="$p"
    break
  fi
done

if [ -z "$PORTA_TELA" ]; then
  echo "Nao achei a tela atendendo em 4173, 5173, 3000 nem 8080." >&2
  echo "Confira:  pm2 status  e  pm2 logs frontend-vite" >&2
  exit 1
fi
echo "  [ok] a tela responde na porta $PORTA_TELA"

echo
echo "============================================================"
echo " 3. Nginx"
echo "============================================================"
if ! command -v nginx >/dev/null 2>&1; then
  echo "  instalando..."
  apt-get update -qq
  apt-get install -y -qq nginx
fi
echo "  [ok] nginx presente"

CONF="/etc/nginx/sites-available/zeus"
cat > "$CONF" <<FIM
# Gerado por servidor/https.sh. Nao editar na mao: rode o script de novo.
server {
    listen 80;
    server_name $DOMINIO;

    # O certbot escreve a prova de posse aqui. O resto vai para o cadeado.
    location /.well-known/acme-challenge/ { root /var/www/html; }
    location / { return 301 https://\$host\$request_uri; }
}

server {
    listen 443 ssl;
    server_name $DOMINIO;

    # O Zeus e o posto de comando do Paulo, nao um site publico: nao ha por
    # que ele aparecer em buscador nem ser guardado por ninguem.
    add_header X-Robots-Tag "noindex, nofollow" always;
    add_header Referrer-Policy "no-referrer" always;

    # A VOZ. Pedaco de audio e grande e demora: o tempo aqui e generoso de
    # proposito, senao o Nginx corta a fala no meio numa maquina lenta.
    location /api/voz {
        proxy_pass http://127.0.0.1:8123;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    # O CEREBRO. A resposta vem EM FLUXO, uma frase por vez — e e isso que
    # faz o Zeus comecar a falar antes de terminar de pensar.
    #
    # As tres linhas abaixo existem para o Nginx NAO segurar esse fluxo. Sem
    # elas ele junta tudo e entrega no fim, desfazendo em silencio o conserto
    # da demora e devolvendo o Zeus para os dez segundos de espera.
    location /api/zeus {
        proxy_pass http://127.0.0.1:8124;
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding on;
        proxy_read_timeout 300s;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    location / {
        proxy_pass http://127.0.0.1:$PORTA_TELA;
        proxy_set_header Host \$host;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
FIM

ln -sf "$CONF" /etc/nginx/sites-enabled/zeus
rm -f /etc/nginx/sites-enabled/default
mkdir -p /var/www/html

nginx -t
systemctl reload nginx
echo "  [ok] nginx configurado para $DOMINIO"

echo
echo "============================================================"
echo " 4. O cadeado"
echo "============================================================"
if ! command -v certbot >/dev/null 2>&1; then
  echo "  instalando certbot..."
  apt-get install -y -qq certbot python3-certbot-nginx
fi

certbot --nginx -d "$DOMINIO" --non-interactive --agree-tos -m "$EMAIL" --redirect
echo "  [ok] certificado emitido e renovacao automatica ligada"

echo
echo "============================================================"
echo " 5. Conferindo"
echo "============================================================"
if curl -sS -m 10 -o /dev/null -w '%{http_code}' "https://$DOMINIO/api/zeus/vivo" | grep -q 200; then
  echo "  [ok] o Zeus responde em https://$DOMINIO"
else
  echo "  [!!] o endereco subiu mas o Zeus nao respondeu. Veja:"
  echo "       journalctl -u zeus-cerebro -n 30 --no-pager"
fi

cat <<FIM

============================================================
 PRONTO
============================================================
Abra no celular e no computador:

    https://$DOMINIO

O microfone vai funcionar nos dois — e a sua senha para de atravessar a
internet aberta.

FALTA UMA COISA, E E SUA: a porta 80 e a 443 precisam estar liberadas no
painel da Hetzner (firewall). Se a pagina nao abrir, e quase sempre isso.

FIM
