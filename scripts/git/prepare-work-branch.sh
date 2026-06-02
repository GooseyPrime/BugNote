#!/usr/bin/env bash
# Create or reset a Cursor PR branch from the remote default branch.
#
# Usage:
#   bash scripts/git/prepare-work-branch.sh <topic-slug> [branch-name]
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <topic-slug> [branch-name]" >&2
  exit 1
fi

topic="$1"
branch="${2:-cursor/${topic}}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

git fetch origin

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
    echo "::error::Could not determine origin default branch." >&2
    exit 1
  fi
fi

if ! git show-ref --verify --quiet "refs/remotes/origin/${default_branch}"; then
  echo "::error::origin/${default_branch} not found. Run: git fetch origin" >&2
  exit 1
fi

git checkout -B "$branch" "origin/${default_branch}"
echo "Ready on branch: $branch (base: origin/${default_branch})"
echo "Next: implement, commit, git push -u origin HEAD, open PR into ${default_branch}."
