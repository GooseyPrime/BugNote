#!/usr/bin/env bash
# Fail if Vitest/Jest mock APIs appear outside test-only paths.
#
# Override scanned dirs:
#   APP_SRC_DIRS="backend/src frontend/src packages/app/src" bash scripts/ci/assert-no-test-mocks-in-app-src.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

PATTERN='vi\.(mock|fn|importActual|hoisted|spyOn|stub)|jest\.(mock|fn|spyOn)'
DEFAULT_DIRS=(src app/src backend/src frontend/src packages)

if [[ -n "${APP_SRC_DIRS:-}" ]]; then
  # shellcheck disable=SC2206
  DIRS=(${APP_SRC_DIRS})
else
  DIRS=("${DEFAULT_DIRS[@]}")
fi

found=false
for dir in "${DIRS[@]}"; do
  [[ -d "$dir" ]] || continue
  while IFS= read -r -d '' f; do
    if match="$(grep -nE "$PATTERN" "$f" 2>/dev/null)"; then
      if [[ "$found" == false ]]; then
        echo "::error::Test mock APIs found in application source outside test paths:" >&2
        found=true
      fi
      echo "$f" >&2
      echo "$match" >&2
      echo >&2
    fi
  done < <(
    find "$dir" -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' -o -name '*.mjs' -o -name '*.cjs' \) \
      ! -path '*/__tests__/*' \
      ! -path '*/test/*' \
      ! -path '*/tests/*' \
      ! -path '*/e2e/*' \
      ! -path '*/fixtures/*' \
      ! -name '*.test.*' \
      ! -name '*.spec.*' \
      -print0
  )
done

if [[ "$found" == true ]]; then
  exit 1
fi

echo "OK: no Vitest/Jest mock APIs found in configured application source trees."
