#!/usr/bin/env bash
# Install a local pre-commit hook that blocks commits on the default branch.
# Optional: CI and agent rules still apply if this is not installed.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

if [[ ! -d "$ROOT/.git" ]]; then
  echo "::error::No .git directory. Run from a clone of this repository." >&2
  exit 1
fi

HOOK_DIR="$ROOT/.git/hooks"
HOOK_PATH="$HOOK_DIR/pre-commit"
ASSERT="$ROOT/scripts/git/assert-not-on-default-branch.sh"
MARKER='Installed by scripts/git/install-pre-commit-hook.sh'

mkdir -p "$HOOK_DIR"

if [[ -f "$HOOK_PATH" ]]; then
  if grep -qF "$MARKER" "$HOOK_PATH" 2>/dev/null; then
    :
  elif grep -q 'assert-not-on-default-branch.sh' "$HOOK_PATH" 2>/dev/null; then
    echo "::warning::pre-commit already calls assert-not-on-default-branch.sh; not overwriting." >&2
    exit 1
  else
    echo "::warning::Existing pre-commit hook preserved. Append this manually:" >&2
    echo "  bash \"$ASSERT\"" >&2
    exit 1
  fi
fi

cat >"$HOOK_PATH" <<'EOF'
#!/usr/bin/env bash
# Installed by scripts/git/install-pre-commit-hook.sh — do not commit this file.
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
bash "${ROOT}/scripts/git/assert-not-on-default-branch.sh"
EOF

chmod +x "$HOOK_PATH"
echo "Installed pre-commit hook at $HOOK_PATH"
