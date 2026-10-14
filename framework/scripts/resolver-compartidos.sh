#!/usr/bin/env bash
# Resuelve conflictos de merge en los archivos compartidos de "solo añadir" (PENDIENTES.md, PASOS-HUMANOS.md,
# docs/CONTRATO.md, docs/DATOS-INVENTADOS.md, FORMULARIO-FINAL.md) conservando las líneas de AMBOS lados (unión).
# Uso (durante un `git merge` con conflictos, desde la raíz del repo):  bash framework/scripts/resolver-compartidos.sh
# Revisa el resultado: si dos agentes editaron la misma línea, quedarán ambas versiones.
set -euo pipefail
shared=(PENDIENTES.md PASOS-HUMANOS.md docs/CONTRATO.md docs/DATOS-INVENTADOS.md FORMULARIO-FINAL.md)
for f in $(git diff --name-only --diff-filter=U); do
  for s in "${shared[@]}"; do
    if [[ "$f" == "$s" ]]; then
      tmp=$(mktemp -d)
      git show ":1:$f" > "$tmp/base" 2>/dev/null || : > "$tmp/base"
      git show ":2:$f" > "$tmp/ours"
      git show ":3:$f" > "$tmp/theirs"
      git merge-file --union "$tmp/ours" "$tmp/base" "$tmp/theirs" || true
      cp "$tmp/ours" "$f"
      git add "$f"
      rm -rf "$tmp"
      echo "unión: $f"
    fi
  done
done
left=$(git diff --name-only --diff-filter=U)
if [[ -n "$left" ]]; then echo "Quedan conflictos por resolver a mano:"; echo "$left"; exit 1; fi
echo "Listo: haz 'git commit' para terminar el merge."
