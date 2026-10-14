#!/usr/bin/env bash
# Arma una copia de integración: framework/ de agente/2-framework + bots/ de agente/3-bots,
# instala dependencias y (opcional) corre el simulador y el red teaming contra el bot real.
#   validacion/integrar.sh                 # solo prepara la copia e imprime la ruta
#   validacion/integrar.sh sim [args...]   # + corre el simulador en proceso (Engine) con args extra
#   validacion/integrar.sh mock            # + corre el simulador con el MockProvider del framework (sin IA)
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
DEST="${INTEGRACION_DIR:-${TMPDIR:-/tmp}/mokalu-integracion}"
FW="${FW_REF:-origin/agente/2-framework}"
BOTS="${BOTS_REF:-origin/agente/3-bots}"
cd "$REPO"
git fetch -q origin agente/2-framework agente/3-bots || true
if [ -d "$DEST/.git" ] || [ -f "$DEST/.git" ]; then
  git -C "$DEST" checkout -q --detach "$FW" -- . 2>/dev/null || git -C "$DEST" checkout -q --detach "$FW"
else
  git worktree add -f --detach "$DEST" "$FW" >/dev/null
fi
git -C "$DEST" checkout -q --detach "$FW"
git -C "$DEST" checkout -q "$BOTS" -- bots/mokalu
echo "framework: $(git rev-parse --short "$FW")  bots: $(git rev-parse --short "$BOTS")  →  $DEST" >&2
(cd "$DEST/framework" && npm ci -s >/dev/null 2>&1 || npm install -s >/dev/null)
(cd "$REPO/validacion/simulador" && [ -d node_modules ] || npm ci -s >/dev/null)
mode="${1:-}"; shift || true
case "$mode" in
  sim)  cd "$REPO/validacion/simulador" && npx tsx src/run.ts --target engine --framework "$DEST/framework" --bots-dir "$DEST/bots" "$@" ;;
  mock) cd "$REPO/validacion/simulador" && LLM_PROVIDER=mock npx tsx src/run.ts --target engine --framework "$DEST/framework" --bots-dir "$DEST/bots" --juez reglas --salida "${SALIDA:-$REPO/validacion/reportes}" "$@" ;;
  *)    echo "$DEST" ;;
esac
