#!/usr/bin/env bash
# Sobe a interface visual do Zeus para testar no navegador.
#
# O servico de voz (zeus-voz) roda em systemd e ja sobe no boot; este
# script cuida so do frontend e confere se a voz esta de pe antes.
set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORTA="${PORTA:-5180}"

cd "$RAIZ"

if ! systemctl is-active --quiet zeus-voz; then
  echo "servico de voz parado; subindo..."
  systemctl start zeus-voz
  sleep 20
fi

if ! curl -sf --max-time 10 http://127.0.0.1:8123/api/voz/saude > /dev/null; then
  echo "ERRO: a voz nao responde em 127.0.0.1:8123"
  echo "  journalctl -u zeus-voz -n 30"
  exit 1
fi

echo "voz: OK"

IP="$(ip -4 addr show scope global | grep -oP 'inet \K[\d.]+' | head -1)"
echo
echo "Abra no navegador:  http://$IP:$PORTA/"
echo "Para parar: Ctrl+C"
echo

# --host 0.0.0.0: sem isto o Vite so escuta em localhost e nada de fora
# do servidor consegue abrir a pagina.
exec npm run dev -- --host 0.0.0.0 --port "$PORTA"
