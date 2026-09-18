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
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

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
echo " 2. De onde a tela vai ser servida"
echo "============================================================"
# ---------------------------------------------------------------------------
# O NGINX SERVE OS ARQUIVOS PRONTOS. NAO PASSA PELO VITE.
# ---------------------------------------------------------------------------
# A primeira versao deste script procurava a tela numa LISTA DE PORTAS FIXAS
# (4173, 5173, 3000, 8080) e parava se nao achasse nenhuma. Foi exatamente o
# que aconteceu na VPS do Paulo em 18/09/2026: o script morreu aqui e o
# cadeado nunca subiu.
#
# Consertar a busca de porta seria remendo. O certo e nem depender dela:
# `npm run build` ja deixa a tela pronta em `dist/`, que sao arquivos
# parados. Nginx serve arquivo parado melhor que qualquer coisa — e assim:
#
#   - nao ha porta para adivinhar;
#   - a tela nao depende mais do PM2 estar de pe;
#   - some um processo Node da memoria, o que numa maquina de 2 GB que ja
#     passou aperto nao e detalhe.
#
# O PM2 pode continuar rodando para o desenvolvimento; ele so deixa de estar
# no caminho de quem abre o Zeus.
DIST="$RAIZ/dist"

if [ ! -f "$DIST/index.html" ]; then
  echo "  a tela ainda nao foi construida. Construindo..."
  (cd "$RAIZ" && npm run build) || {
    echo "Nao consegui construir a tela. Rode 'npm run build' e veja o erro." >&2
    exit 1
  }
fi

if [ ! -f "$DIST/index.html" ]; then
  echo "Mesmo depois de construir, nao achei $DIST/index.html." >&2
  exit 1
fi
echo "  [ok] a tela pronta esta em $DIST"

echo
echo "============================================================"
echo " 3. Nginx"
echo "============================================================"
if ! command -v nginx >/dev/null 2>&1; then
  echo "  instalando..."
  apt-get update -qq
  apt-get install -y -qq nginx
fi
# `enable --now` e nao so `start`: o Nginx tem que voltar sozinho se a maquina
# reiniciar. Na VPS do Paulo ele estava instalado e PARADO — e servico parado
# recusa conexao, que foi o "conexao recusada" que ele viu no navegador.
systemctl enable --now nginx >/dev/null 2>&1 || true
echo "  [ok] nginx presente"

CONF="/etc/nginx/sites-available/zeus"

# ---------------------------------------------------------------------------
# UM BLOCO SO, NA PORTA 80. O CERTBOT FAZ O DE 443.
# ---------------------------------------------------------------------------
# A primeira versao ja escrevia o bloco 443 aqui — e isso NAO FUNCIONA: um
# `listen 443 ssl` sem certificado faz o `nginx -t` recusar a configuracao
# inteira, antes mesmo de o certbot ter chance de emitir um.
#
# O caminho certo e o contrario: sobe so a porta 80 com tudo funcionando, e o
# certbot clona este bloco para 443, poe o certificado e cria o redirecionamento.
cat > "$CONF" <<FIM
# Gerado por servidor/https.sh. Nao editar na mao: rode o script de novo.
# O bloco de 443 e acrescentado pelo certbot.
server {
    listen 80;
    server_name $DOMINIO;

    # O Zeus e o posto de comando do Paulo, nao um site publico: nao ha por
    # que ele aparecer em buscador.
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
    # As linhas de buffering existem para o Nginx NAO segurar esse fluxo. Sem
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

    # A TELA, servida direto do disco. Sem porta para adivinhar e sem depender
    # do PM2 estar de pe.
    root $DIST;
    index index.html;

    location / {
        # A tela e uma pagina so: qualquer endereco tem que cair nela, senao
        # recarregar com F5 daria 404.
        try_files \$uri \$uri/ /index.html;
    }
}
FIM

ln -sf "$CONF" /etc/nginx/sites-enabled/zeus
rm -f /etc/nginx/sites-enabled/default
mkdir -p /var/www/html

# O Nginx precisa ALCANCAR os arquivos. A pasta do projeto mora em /root, que
# e fechada para todos menos o dono — sem isto a tela daria 403.
chmod o+x /root 2>/dev/null || true
chmod -R o+rX "$DIST" 2>/dev/null || true

nginx -t
# restart e nao reload: reload em servico parado nao sobe nada.
systemctl restart nginx
echo "  [ok] nginx de pe, servindo $DOMINIO na porta 80"

echo
echo "============================================================"
echo " 4. O cadeado"
echo "============================================================"
# CONFERIR A PORTA 80 DE FORA, ANTES DE PEDIR O CERTIFICADO.
#
# A Let's Encrypt prova a posse do dominio batendo na porta 80 vinda da
# internet. Se o firewall da Hetzner nao deixar entrar, o pedido falha — e
# tentativa falhada CONTA no limite semanal dela. Melhor descobrir aqui, de
# graca, do que queimar tentativa.
echo "  conferindo se a porta 80 responde de fora..."
DE_FORA="$(curl -sS -m 15 -o /dev/null -w '%{http_code}' "http://$DOMINIO/" 2>/dev/null || echo '000')"
if [ "$DE_FORA" = "000" ]; then
  cat >&2 <<AVISO

============================================================
 PARE AQUI: A PORTA 80 NAO RESPONDE DE FORA
============================================================
O Nginx esta de pe nesta maquina, mas o pedido vindo da internet nao chega.
Isso e FIREWALL, e ele nao e desta maquina — e do painel da Hetzner.

  Hetzner Cloud > Firewalls > (o firewall desta VPS) > Rules > Inbound
  Libere TCP 80 e TCP 443 para qualquer origem (0.0.0.0/0 e ::/0)

Depois rode este script de novo. Nao insisti no certificado de proposito:
tentativa falhada conta no limite semanal da Let's Encrypt.

AVISO
  exit 1
fi
echo "  [ok] a porta 80 responde de fora (codigo $DE_FORA)"

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
