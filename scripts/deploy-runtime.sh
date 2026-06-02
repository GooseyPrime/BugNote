#!/usr/bin/env bash
# Runs ON the Emma VM, invoked over SSH by the deploy workflow.
set -euo pipefail

APP_DIR="${BUGNOTE_APP_DIR:-/home/bugnote/bugnote}"
cd "$APP_DIR"

echo "==> Fetching latest main"
git fetch --all --prune
git reset --hard origin/main

echo "==> Installing dependencies"
npm ci

echo "==> Building workspaces"
npm run build

echo "==> Running database migrations (bugnote db only)"
npm run db:migrate

echo "==> Reloading PM2 processes"
pm2 reload ecosystem.config.cjs --update-env || pm2 start ecosystem.config.cjs
pm2 save

echo "==> Deploy complete"
