# BugNote — Document 3 of 3

## Deployment & Operations Guide

**Audience:** you (Brandon), executing on the Emma VM and in the GitHub / DO / Vercel / Clerk dashboards.
**Prereqs:** SSH + sudo on Emma; Postgres superuser on Emma; admin on the `GooseyPrime` GitHub org; a DigitalOcean Spaces account; a Vercel account; a Clerk application.

Run the sections in order. Everything BugNote touches is namespaced `bugnote` so nothing collides with ResearchOne.

---

## 1. One-time Emma VM setup

### 1.1 Create the isolated `bugnote` user
```bash
sudo adduser --disabled-password --gecos "" bugnote
sudo mkdir -p /home/bugnote/.ssh && sudo chmod 700 /home/bugnote/.ssh
sudo chown -R bugnote:bugnote /home/bugnote/.ssh
```
The `bugnote` user shares no group with the ResearchOne deploy user. It owns only its own home and logs.

### 1.2 Deploy SSH key (GitHub Actions → Emma)
On your laptop, generate a key dedicated to BugNote deploys (do not reuse ResearchOne's):
```bash
ssh-keygen -t ed25519 -C "bugnote-deploy" -f ./bugnote_deploy -N ""
```
- Append `bugnote_deploy.pub` to Emma: `sudo tee -a /home/bugnote/.ssh/authorized_keys < bugnote_deploy.pub` then `sudo chown bugnote:bugnote /home/bugnote/.ssh/authorized_keys && sudo chmod 600 /home/bugnote/.ssh/authorized_keys`.
- The **private** key `bugnote_deploy` becomes GitHub secret `BUGNOTE_SSH_KEY` (§4). Delete both local copies afterward.
- Pin host keys for the workflow: `ssh-keyscan -H <emma-host> ` → store output as `BUGNOTE_KNOWN_HOSTS`.

### 1.3 Log directory
```bash
sudo mkdir -p /var/log/bugnote && sudo chown bugnote:bugnote /var/log/bugnote
```

### 1.4 Node + PM2 for the bugnote user
As `bugnote` (`sudo -iu bugnote`): install Node 20 (nvm or system), then:
```bash
npm i -g pm2
git clone git@github.com:GooseyPrime/bugnote.git /home/bugnote/bugnote
cd /home/bugnote/bugnote && npm ci && npm run build
```
Enable PM2 boot persistence for this user:
```bash
pm2 startup systemd -u bugnote --hp /home/bugnote   # run the printed sudo command
pm2 save
```

### 1.5 Postgres bootstrap (isolated db + role)
As the Postgres superuser, edit the password in `infra/postgres/bootstrap.sql`, then:
```bash
sudo -u postgres psql -f /home/bugnote/bugnote/infra/postgres/bootstrap.sql
```
This creates the `bugnote` database owned by `bugnote_app` and revokes the role from `researchone`. Build the connection string for `.env`:
```
DATABASE_URL=postgresql://bugnote_app:<password>@127.0.0.1:5432/bugnote
```
Verify isolation: `psql "postgresql://bugnote_app:<pw>@127.0.0.1:5432/researchone"` must be **denied**.

### 1.6 Worker resource isolation (so it never starves ResearchOne)
PM2 has no CPU-priority flag, so run the worker through `nice`. Create `scripts/worker-nice.sh`:
```bash
#!/usr/bin/env bash
exec nice -n 10 node apps/server/dist/worker.js
```
`chmod +x scripts/worker-nice.sh`, and point the `bugnote-worker` PM2 app's `script` at `scripts/worker-nice.sh` instead of `dist/worker.js`. The `max_memory_restart: "768M"` in `ecosystem.config.cjs` already caps memory. For a hard cap, optionally wrap PM2 in a systemd slice:
```ini
# /etc/systemd/system/bugnote.slice
[Slice]
CPUQuota=80%
MemoryMax=1500M
```
and add `Slice=bugnote.slice` to the PM2 systemd unit's `[Service]`. Optional at launch; do it if you see contention.

### 1.7 nginx vhost + TLS
Point DNS `api.bugnote.intellme.com` at Emma, then:
```nginx
# /etc/nginx/sites-available/bugnote
server {
  server_name api.bugnote.intellme.com;
  client_max_body_size 10m;            # inline screenshots
  location / { proxy_pass http://127.0.0.1:8090; proxy_set_header Host $host; proxy_set_header X-Real-IP $remote_addr; }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/bugnote /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api.bugnote.intellme.com
```
Health URL for the deploy workflow: `https://api.bugnote.intellme.com/health` → `BUGNOTE_PUBLIC_HEALTH_URL`.

---

## 2. GitHub App (draft PR generation)

1. `GooseyPrime` org → Settings → Developer settings → GitHub Apps → **New GitHub App**.
2. Name `bugnote-bot`. Homepage any URL. **Uncheck Webhook → Active** (v1 needs no inbound webhooks).
3. Repository permissions: **Contents = Read & write**, **Pull requests = Read & write**. Nothing else. No org permissions.
4. Where can it be installed: **Only on this account**. Create.
5. Note the **App ID** → `GITHUB_APP_ID`. Generate a **private key**; the downloaded `.pem` contents → `GITHUB_APP_PRIVATE_KEY` (keep the newlines — the deploy `.env` heredoc preserves them).
6. **Install** the App and select the target repos: `GooseyPrime/ResearchOne`, your thenewontology.life repo, and any others.
7. Build the repo map (env `GITHUB_APP_REPO_MAP`), keyed by the `appId` each widget sends:
```json
{"researchone":"GooseyPrime/ResearchOne","newontology":"GooseyPrime/<newontology-repo>"}
```
`GITHUB_APP_WEBHOOK_SECRET` stays empty/unused in v1.

---

## 3. DO Spaces + Vercel + Clerk

### 3.1 Spaces (screenshots)
Create a bucket `bugnote-screenshots` (private). Generate a Spaces access key/secret. Fill `SPACES_ENDPOINT` (e.g. `https://nyc3.digitaloceanspaces.com`), `SPACES_BUCKET`, `SPACES_KEY`, `SPACES_SECRET`. This is a **separate** bucket/key from ResearchOne's.

### 3.2 Clerk (dashboard auth)
Use a Clerk application (new or existing). Copy the **Publishable** and **Secret** keys → `CLERK_PUBLISHABLE_KEY` (server) / `VITE_CLERK_PUBLISHABLE_KEY` (dashboard) and `CLERK_SECRET_KEY` (server). Restrict sign-ups to yourself (Clerk → Restrictions → allowlist your email).

### 3.3 Vercel (dashboard)
Import `GooseyPrime/bugnote`, set **Root Directory = `apps/dashboard`**, framework preset **Vite**. Env vars: `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_API_BASE=https://api.bugnote.intellme.com`. Deploy. Then add the resulting Vercel URL to the server's admin CORS allowlist (`ADMIN_ALLOWED_ORIGINS`) and redeploy the server.

---

## 4. Secrets checklist (GitHub repo → Settings → Secrets and variables → Actions)

| Secret | Value |
|---|---|
| `BUGNOTE_EMMA_HOST` | Emma's host/IP (same machine as ResearchOne) |
| `BUGNOTE_EMMA_USER` | `bugnote` |
| `BUGNOTE_SSH_KEY` | the private `bugnote_deploy` key (§1.2) |
| `BUGNOTE_KNOWN_HOSTS` | output of `ssh-keyscan -H <emma-host>` |
| `BUGNOTE_PUBLIC_HEALTH_URL` | `https://api.bugnote.intellme.com/health` |
| `BUGNOTE_WRITE_BACKEND_ENV` | the full `.env` payload (below) |

The `BUGNOTE_WRITE_BACKEND_ENV` payload is your production `.env`, built from `.env.example`:
```bash
NODE_ENV=production
PORT=8090
DATABASE_URL=postgresql://bugnote_app:<pw>@127.0.0.1:5432/bugnote
INGEST_ALLOWED_ORIGINS=https://researchone.io,https://thenewontology.life
INGEST_RATE_LIMIT_PER_MIN=30
ADMIN_ALLOWED_ORIGINS=https://<your-vercel-dashboard-url>
OPENROUTER_API_KEY=<reuse your existing key or a scoped one>
OPENROUTER_MODEL_TRIAGE=<cheap/fast model id>
OPENROUTER_MODEL_ANALYSIS=<vision-capable model id>
OPENROUTER_MODEL_FIX=<strong reasoner model id>
AGENT_COST_BUDGET_USD=0.50
AGENT_CONFIDENCE_GATE=0.6
GITHUB_APP_ID=<app id>
GITHUB_APP_PRIVATE_KEY=<paste full PEM incl. BEGIN/END lines and newlines>
GITHUB_APP_REPO_MAP={"researchone":"GooseyPrime/ResearchOne"}
SPACES_ENDPOINT=https://nyc3.digitaloceanspaces.com
SPACES_BUCKET=bugnote-screenshots
SPACES_KEY=<spaces key>
SPACES_SECRET=<spaces secret>
CLERK_SECRET_KEY=<clerk secret>
CLERK_PUBLISHABLE_KEY=<clerk publishable>
```
> Pick the three OpenRouter model ids when you set this up — they change often, so check current availability and pricing on openrouter.ai rather than hardcoding from memory. Start cheap on triage, vision on analysis, strongest on fix.

---

## 5. First deploy

Push to `main` (or run the **Deploy BugNote to Emma** workflow via dispatch). The workflow SSHes in as `bugnote`, writes `.env`, runs `scripts/deploy-runtime.sh` (pull → `npm ci` → build → migrate → PM2 reload), and polls `/health`. Then:
```bash
sudo -iu bugnote
pm2 ls            # expect bugnote-api + bugnote-worker online
pm2 logs bugnote-worker --lines 50
curl -s https://api.bugnote.intellme.com/health
```

---

## 6. Per-app onboarding (repeat per app/site)

For each app you add (e.g. `researchone`, `newontology`):

1. **Choose an `appId`** — a short stable string the widget sends (this is what separates issues in the dashboard).
2. **Allow its origin** — add the site's URL to `INGEST_ALLOWED_ORIGINS` in the `.env` payload; re-set `BUGNOTE_WRITE_BACKEND_ENV` and redeploy.
3. **Map its repo** — add `"<appId>":"GooseyPrime/<repo>"` to `GITHUB_APP_REPO_MAP`; redeploy. (Skip if you only want capture, no PRs — it'll stop at `analyzed`.)
4. **Install the widget** in the host app:
   - React (ResearchOne): `npm i @bugnote/widget`, then wrap the app once:
     ```tsx
     import { BugNoteProvider } from "@bugnote/widget/react";
     <BugNoteProvider appId="researchone" endpoint="https://api.bugnote.intellme.com/v1/ingest"
       getUserId={() => clerkUser?.id}>
       <App />
     </BugNoteProvider>
     ```
   - Plain site (thenewontology.life): add before `</body>`:
     ```html
     <script src="https://unpkg.com/@bugnote/widget/dist/bugnote.umd.js"></script>
     <script>BugNote.init({ appId: "newontology", endpoint: "https://api.bugnote.intellme.com/v1/ingest" });</script>
     ```
5. **Deploy the host app.** The BugNote button is now resident on every page.

---

## 7. First-run smoke test

1. On a staging build of ResearchOne, trigger a deliberate error (e.g. a `throw` behind a debug button), then click the BugNote button.
2. Confirm the modal shows the screenshot; add a note; submit.
3. In the dashboard, the report appears under `researchone` as `queued`, then progresses through the dossier stages.
4. If actionable and above the gate, a **draft PR** appears on `GooseyPrime/ResearchOne` (branch `bugnote/<id>`), linked from the report detail.
5. Open the PR — its own CI runs the tests. Review, edit, merge (or close). Nothing auto-merged.

If it halts early, the report detail shows `haltedReason` (`not actionable`, `below confidence gate`, `no repo mapped`, or a budget halt) — exactly the diagnostic you want.

---

## 8. Operations

- **Logs:** `pm2 logs bugnote-api` / `bugnote-worker`; files in `/var/log/bugnote/`.
- **Queue health:**
  ```sql
  SELECT stage, status, count(*) FROM jobs GROUP BY stage, status;
  SELECT * FROM jobs WHERE status='failed' ORDER BY created_at DESC LIMIT 20;
  ```
- **Cost watch:** `SELECT app_id, sum((dossier->>'costUsd')::float) FROM reports GROUP BY app_id;` Tune `AGENT_COST_BUDGET_USD` / model ids if it drifts.
- **PII / retention:** screenshots can contain user data. Spaces encrypts at rest; on top of that, run a daily purge (cron as `bugnote`) deleting screenshot objects and nulling `screenshot_url` for reports older than your retention window (e.g. 30 days), and consider redacting `console_log` after resolution. Keep the retention window short while in test.
- **Secret rotation:** rotate `bugnote_app`'s password (`ALTER ROLE bugnote_app WITH PASSWORD …` → update `.env` secret → redeploy) and the GitHub App key annually, mirroring your ResearchOne rotation practice.
- **Rollback:** `sudo -iu bugnote; cd ~/bugnote; git reset --hard <previous-sha>; npm ci && npm run build && pm2 reload ecosystem.config.cjs`. Because the lane is isolated, a bad BugNote deploy never affects ResearchOne.

---

## Package complete

Five files make up the full setup package:
1. **Doc 1** — Copilot repo brief (scaffold + infra-as-code + governance)
2. **Doc 2 / WO-1–2** — widget SDK + ingest/queue
3. **Doc 2 / WO-3–4** — agent pipeline + GitHub App
4. **Doc 2 / WO-5** — review dashboard
5. **Doc 3** — this deployment & operations guide

Hand Doc 1 to Copilot, Docs 2 to Cursor in order, and work Doc 3 yourself. The result is an isolated, budgeted, human-gated auto-debugging tool living quietly beside ResearchOne on Emma.
