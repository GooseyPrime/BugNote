#!/usr/bin/env bash
# Optional public-copy guard. It runs only when both config files contain entries.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

MANIFEST="${PUBLIC_COPY_MANIFEST:-docs/public-copy/public-copy-manifest.txt}"
PATTERNS="${PUBLIC_COPY_BANNED_PATTERNS:-docs/public-copy/banned-public-jargon.txt}"

if [[ ! -f "$MANIFEST" || ! -f "$PATTERNS" ]]; then
  echo "SKIP: public-copy manifest/pattern files not configured."
  exit 0
fi

read_clean_lines() {
  local file="$1"
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%%#*}"
    line="${line#"${line%%[![:space:]]*}"}"
    line="${line%"${line##*[![:space:]]}"}"
    [[ -n "$line" ]] && printf '%s\n' "$line"
  done < "$file"
}

mapfile -t paths < <(read_clean_lines "$MANIFEST")
mapfile -t pattern_lines < <(read_clean_lines "$PATTERNS")

if [[ ${#paths[@]} -eq 0 || ${#pattern_lines[@]} -eq 0 ]]; then
  echo "SKIP: public-copy manifest or banned-pattern list has no active entries."
  exit 0
fi

missing=()
for p in "${paths[@]}"; do
  [[ -f "$p" ]] || missing+=("$p")
done
if [[ ${#missing[@]} -gt 0 ]]; then
  echo "::error::Public-copy manifest references missing files:" >&2
  printf '  %s\n' "${missing[@]}" >&2
  exit 1
fi

violations=()
for p in "${paths[@]}"; do
  for pattern in "${pattern_lines[@]}"; do
    while IFS= read -r match_line; do
      [[ -n "$match_line" ]] && violations+=("$match_line")
    done < <(grep -HniE "$pattern" "$p" 2>/dev/null || true)
  done
done

if [[ ${#violations[@]} -gt 0 ]]; then
  printf '%s\n' "${violations[@]}" >&2
  echo "::error::Banned public-copy pattern found." >&2
  exit 1
fi

echo "Public-copy banned-pattern check passed (${#paths[@]} files)."
