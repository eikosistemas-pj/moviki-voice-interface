#!/usr/bin/env bash
#
# parar.sh — o botao de panico.
#
#   sudo bash servidor/parar.sh
#
# Derruba o cerebro do Zeus e forca o turno a fechar, SEM passar por ele.
# Funciona mesmo que ele esteja travado, mudo ou respondendo besteira: a
# garantia de que o Paulo entra quando quiser nao pode depender do robo.

set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ESTADO="${ZEUS_ESTADO:-$RAIZ/dados/estado.json}"

echo "Derrubando o cerebro do Zeus..."
systemctl stop zeus-cerebro 2>/dev/null || echo "  (o servico ja nao estava de pe)"

if [ -f "$ESTADO" ]; then
  # Fecha o turno no arquivo. Sem node, sem servidor, sem o Zeus no meio.
  python3 - "$ESTADO" <<'PY' 2>/dev/null || sed -i 's/"aberto": true/"aberto": false/' "$ESTADO"
import json, sys
caminho = sys.argv[1]
with open(caminho) as f:
    d = json.load(f)
d.setdefault("turno", {})["aberto"] = False
d["turno"]["fechadoPorPanico"] = True
with open(caminho, "w") as f:
    json.dump(d, f, indent=2)
PY
  echo "  turno fechado em $ESTADO"
fi

cat <<FIM

Pronto. O Zeus esta parado e o turno esta fechado.

Para ligar de novo:   sudo systemctl start zeus-cerebro
Para ver o que houve: journalctl -u zeus-cerebro -n 50 --no-pager
FIM
