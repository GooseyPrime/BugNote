#!/usr/bin/env bash
# Refuse commits on the repository default branch unless explicitly overridden.
#
# Override only when the user authorized direct default-branch work in the same
# request:
#   ALLOW_DIRECT_MAIN_PUSH=1 git commit -m "hotfix: ... [direct-main]"
set -euo pipefail

if [[ "${ALLOW_DIRECT_MAIN_PUSH:-}" == "1" ]]; then
  exit 0
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "::error::Not inside a git work tree." >&2
  exit 1
fi

branch="${GITHUB_HEAD_REF:-${CI_PR_HEAD_REF:-}}"
if [[ -z "$branch" ]]; then
  branch="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
fi
if [[ -z "$branch" || "$branch" == "HEAD" ]]; then
  echo "::error::Detached HEAD. Create or checkout a PR branch before committing." >&2
  exit 1
fi

default_branch="${DEFAULT_BRANCH:-}"
if [[ -z "$default_branch" ]]; then
  default_branch="$(git remote show origin 2>/dev/null | sed -n 's/.*HEAD branch: //p' | head -n1 || true)"
fi
if [[ -z "$default_branch" ]]; then
  if git show-ref --verify --quiet refs/remotes/origin/main; then
    default_branch="main"
  elif git show-ref --verify --quiet refs/remotes/origin/master; then
    default_branch="master"
  else
    default_branch="main"
  fi
fi

case "$branch" in
  "$default_branch"|main|master)
    echo "::error::Refusing work on default branch '${branch}'." >&2
    echo "Create a PR branch from fresh origin/${default_branch}:" >&2
    echo "  bash scripts/git/prepare-work-branch.sh <topic-slug>" >&2
    echo "For explicitly authorized break-glass work only:" >&2
    echo "  ALLOW_DIRECT_MAIN_PUSH=1 git commit -m '... [direct-main]'" >&2
    exit 1
    ;;
esac

exit 0
