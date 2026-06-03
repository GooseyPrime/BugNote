#!/usr/bin/env bash
# Fail if the deprecated VITE_API_BASE env name appears (use VITE_API_BASE_URL).
set -euo pipefail
root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$root"
shopt -s globstar nullglob
hits=()
while IFS= read -r line; do
  hits+=("$line")
done < <(
  grep -RIn 'VITE_API_BASE' \
    --exclude-dir=node_modules \
    --exclude-dir=dist \
    --exclude=package-lock.json \
    --exclude='assert-vite-api-base-url.sh' \
    . 2>/dev/null | grep -v 'VITE_API_BASE_URL' || true
)
if ((${#hits[@]} > 0)); then
  echo "error: found VITE_API_BASE — use VITE_API_BASE_URL instead" >&2
  printf '%s\n' "${hits[@]}" >&2
  exit 1
fi
echo "ok: no deprecated VITE_API_BASE references"
