#!/usr/bin/env bash
# servidor/medir.sh  (repo: moviki-voice-interface)
#
# RESPONDE A PERGUNTA "E A MAQUINA OU E O CODIGO?" COM NUMERO.
#
# O Paulo perguntou em 18/09/2026 se a VPS que ele comprou aguenta o Zeus, ou
# se a demora e defeito meu. Sem medir, isso vira discussao de opiniao — e a
# decisao de trocar de maquina custa dinheiro para ser tomada no chute.
#
# A demora do Zeus tem TRES pedacos, e eles nao tem o mesmo dono:
#
#   1. o navegador decidir que voce parou de falar   (nem maquina, nem codigo)
#   2. o cerebro pensar     -> API da Anthropic      (nao usa a CPU da VPS)
#   3. a VOZ virar audio    -> Kokoro, na VPS        (usa a CPU da VPS, sozinha)
#
# So o pedaco 3 depende da maquina. E ele e o unico que roda num processador
# so. Por isso este script mede ELE.
#
# COMO RODAR (na VPS, pelo PowerShell: ssh root@204.168.204.48)
#   cd /root/eikosistemas/moviki-voice-interface
#   bash servidor/medir.sh

set -u

VOZ="${ZEUS_VOZ_URL:-http://127.0.0.1:8123/api/voz}"
SAIDA="$(mktemp -d)"
trap 'rm -rf "$SAIDA"' EXIT

echo "============================================================"
echo " A MAQUINA"
echo "============================================================"
echo "Processadores:  $(nproc)"
echo "Memoria:"
free -h | sed -n '2p;3p' | sed 's/^/  /'
echo "Carga agora:    $(cut -d' ' -f1-3 /proc/loadavg)   (acima do numero de processadores = fila)"

# CPU roubada: a Hetzner dividindo o processador com outro cliente. Se este
# numero passa de uns 5%, a maquina esta esperando vez, e nenhum conserto de
# codigo resolve isso.
ROUBO="$(vmstat 1 2 2>/dev/null | tail -1 | awk '{print $16}')"
[ -n "${ROUBO:-}" ] && echo "CPU roubada:    ${ROUBO}%  (acima de 5% = voce divide o processador com outro cliente)"

echo
echo "============================================================"
echo " A VOZ — quanto tempo o Kokoro leva para virar audio"
echo "============================================================"

medir_um() {
  local nome="$1" texto="$2"
  local corpo inicio fim segundos tamanho
  corpo="$(printf '{"texto":%s,"voz":"pm_alex","idioma":"pt-br","velocidade":1.0}' \
    "$(printf '%s' "$texto" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')")"

  inicio="$(date +%s.%N)"
  if ! curl -sS -m 180 -X POST "$VOZ" \
      -H 'Content-Type: application/json' \
      -d "$corpo" -o "$SAIDA/a.wav" -w '%{http_code}' > "$SAIDA/codigo" 2>"$SAIDA/erro"; then
    echo "  $nome: NAO CONSEGUI FALAR COM A VOZ ($VOZ)"
    echo "    $(head -1 "$SAIDA/erro")"
    echo "    Confira:  systemctl status zeus-voz"
    return 1
  fi
  fim="$(date +%s.%N)"

  if [ "$(cat "$SAIDA/codigo")" != "200" ]; then
    echo "  $nome: a voz respondeu $(cat "$SAIDA/codigo") em vez de 200"
    return 1
  fi

  segundos="$(echo "$fim - $inicio" | bc)"
  tamanho="${#texto}"
  printf '  %-22s %3d letras  ->  %5.1fs\n' "$nome" "$tamanho" "$segundos"
}

echo "(a primeira e sempre a mais lenta: o motor esta acordando)"
medir_um "aquecendo" "Pronto."
echo
medir_um "frase curta" "Terminei o rodape."
medir_um "primeiro pedaco" "Terminei o rodape do painel do lojista e abri um Pull Request."
medir_um "resposta inteira" "Terminei o rodape do painel do lojista e abri um Pull Request para voce aprovar. Tem mais dois Pull Requests seus parados ha horas no site publico. No robo do dinheiro eu nao mexi."

echo
echo "============================================================"
echo " COMO LER ISTO"
echo "============================================================"
cat <<'FIM'
  O que decide a demora que voce SENTE e a linha "frase curta": e o tempo ate
  o Zeus abrir a boca. O resto ele sintetiza escondido, enquanto ja esta
  falando.

  "frase curta" abaixo de 1,5s  -> a maquina esta dando conta. Demora que
                                   sobrar e minha, de codigo.
  "frase curta" entre 1,5s e 3s -> apertado. Da para conviver, mas nao e
                                   "toma la da ca".
  "frase curta" acima de 3s     -> a maquina e o gargalo. Nenhum conserto meu
                                   tira isso: ou mais processadores (CPX22 /
                                   CPX32), ou a voz sai da VPS.

  E compare "frase curta" com "resposta inteira": a diferenca entre as duas e
  exatamente o que o conserto do fluxo tirou do seu tempo de espera.
FIM

echo
echo "============================================================"
echo " O CEREBRO — o que o registro diz das ultimas conversas"
echo "============================================================"
journalctl -u zeus-cerebro -n 200 --no-pager 2>/dev/null \
  | grep -i "pensou\|trabalho pronto\|API recusou" | tail -10 \
  || echo "  (sem registro — o servico ja rodou desde o ultimo restart?)"
echo
echo "  'primeira frase em Xs' e a demora de conversa que depende da Anthropic."
echo "  'API recusou' e falha de verdade: me mande a linha inteira."
