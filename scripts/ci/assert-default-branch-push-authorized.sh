#!/usr/bin/env bash
# Fail CI when a commit lands on the default branch without an allowed provenance.
#
# Allowed:
#   - Merge commits
#   - Squash commits referencing a PR number
#   - Commits associated with a PR via GitHub API
#   - Explicit break-glass direct commits containing [direct-main]
#   - ALLOW_DIRECT_MAIN_PUSH=1 workflow override
set -euo pipefail

if [[ "${ALLOW_DIRECT_MAIN_PUSH:-}" == "1" ]]; then
  echo "default-branch-push-gate: skipped (ALLOW_DIRECT_MAIN_PUSH=1)"
  exit 0
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

sha="${GITHUB_SHA:-$(git rev-parse HEAD)}"
msg="$(git log -1 --format=%B "$sha")"
parents="$(git rev-list --parents -n 1 "$sha" | awk '{print NF-1}')"

if [[ "$parents" -ge 2 ]]; then
  echo "default-branch-push-gate: ok (merge commit, $parents parents)"
  exit 0
fi

if echo "$msg" | grep -qiE '\[direct-main\]'; then
  echo "default-branch-push-gate: ok ([direct-main] in commit message)"
  exit 0
fi

if echo "$msg" | grep -qE '\(#[0-9]+\)'; then
  echo "default-branch-push-gate: ok (PR reference in commit message)"
  exit 0
fi

repo="${GITHUB_REPOSITORY:-}"
if [[ -n "$repo" ]] && command -v gh >/dev/null 2>&1 && command -v jq >/dev/null 2>&1; then
  pr_count="$(gh api -H "Accept: application/vnd.github+json" \
    "repos/${repo}/commits/${sha}/pulls" 2>/dev/null | jq 'length' 2>/dev/null || echo 0)"
  if [[ "${pr_count:-0}" =~ ^[0-9]+$ ]] && [[ "$pr_count" -gt 0 ]]; then
    echo "default-branch-push-gate: ok (commit associated with PR via GitHub API)"
    exit 0
  fi
fi

echo "::error::Unauthorized direct push to default branch." >&2
echo "Commit: $sha" >&2
echo "This push does not look like a merged PR or authorized [direct-main] commit." >&2
echo "Move work to a PR branch:" >&2
echo "  bash scripts/git/prepare-work-branch.sh <topic>" >&2
echo "First line of commit message:" >&2
echo "$msg" | head -n 1 >&2
exit 1
