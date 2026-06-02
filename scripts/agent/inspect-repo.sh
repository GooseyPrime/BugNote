#!/usr/bin/env bash
# Lightweight repository inspection helper for agents. It prints evidence; it
# does not modify files.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

echo "# Repository inspection"
echo
echo "## Root"
pwd
echo
echo "## Top-level files"
find . -maxdepth 2 -mindepth 1 -not -path './.git*' | sort | sed 's#^./#- #' | head -200

echo
echo "## Package/build files"
find . -maxdepth 4 -type f \( \
  -name 'package.json' -o -name 'pnpm-workspace.yaml' -o -name 'yarn.lock' -o -name 'package-lock.json' -o \
  -name 'pyproject.toml' -o -name 'requirements.txt' -o -name 'poetry.lock' -o \
  -name 'Cargo.toml' -o -name 'go.mod' -o -name 'Makefile' -o -name 'docker-compose.yml' -o \
  -name 'Dockerfile' -o -name '*.csproj' -o -name 'pom.xml' -o -name 'build.gradle' \
\) -print | sort

echo
echo "## Candidate docs"
find . -maxdepth 4 -type f \( \
  -iname 'README*' -o -iname 'AGENTS.md' -o -path './.cursor/rules/*' -o \
  -iname 'CONTRIBUTING*' -o -iname '*ARCHITECTURE*' -o -iname '*RUNBOOK*' -o \
  -iname '*POLICY*' -o -iname '*SECURITY*' -o -iname '*DEPLOY*' \
\) -print | sort | head -200

echo
echo "## GitHub workflows"
find .github/workflows -maxdepth 1 -type f -print 2>/dev/null | sort || true

echo
echo "## Env examples"
find . -maxdepth 4 -type f \( -name '.env.example' -o -name '*.env.example' -o -name '.env.*.example' \) -print | sort

echo
echo "## Suggested next step"
echo "Create or update docs/agent/REPO_PROFILE.md from docs/agent/REPO_PROFILE.template.md using the evidence above."
