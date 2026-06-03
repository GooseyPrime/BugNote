# Repository profile — BugNote

## Repository identity

- Repository name: bugnote
- Product/application name: BugNote
- Primary owner/team: GooseyPrime
- Default branch: main
- Production branch/deploy trigger: push to `main` (Emma server via `deploy-bugnote-emma.yml`)

## Topology

| Area | Path | Purpose |
|---|---|---|
| Widget SDK | `packages/widget` | Embeddable capture (ESM + UMD + React) |
| Shared contracts | `packages/shared` | Zod schemas |
| GitHub App | `packages/github-app` | File retrieval + draft PR |
| API + worker | `apps/server` | Ingest, queue, agent pipeline |
| Dashboard | `apps/dashboard` | Google OAuth (single-admin) review console (Vercel) |
| Migrations | `apps/server/drizzle` | Postgres schema |
| Deploy | `ecosystem.config.cjs`, `scripts/deploy-runtime.sh` | PM2 on Emma |
| Ops guide | `docs/BugNote-Doc3-Deployment-Guide.md` | Emma/Vercel/Google OAuth setup |

## Package managers and commands

| Scope | Install | Typecheck | Test | Build | Migrate |
|---|---|---|---|---|---|
| Root | `npm ci` | `npm run typecheck` | `npm test` | `npm run build` | `npm run db:migrate` |
| Server | — | `npm run typecheck -w apps/server` | `npm run test:unit -w apps/server` + `test:integration` | `npm run build -w apps/server` | `npm run db:migrate -w apps/server` |

## Test tiers

| Tier | Command | Requires |
|---|---|---|
| Unit | `npm run test:unit -w apps/server` (and widget/shared) | Nothing |
| Integration | `npm run test:integration -w apps/server` | `DATABASE_URL` (CI provides Postgres 16 service) |

CI runs `db:migrate` before `npm test`. Integration tests must not pass with a mocked DB for queue/dedup/ingest paths.

## Test-seam policy (mocks in test files only)

| Boundary | Module |
|---|---|
| LLM | `apps/server/src/agents/openrouter.ts` |
| GitHub | `@bugnote/github-app` |
| Storage | `apps/server/src/storage.ts` |
| Auth | `apps/server/src/api/auth.ts` |

`scripts/ci/assert-no-test-mocks-in-app-src.sh` scans `src` / `packages` trees and **excludes** `__tests__/`, `tests/`, `*.test.*`, `*.spec.*`.

## Local services

| Service | Port | Health |
|---|---:|---|
| API | 8090 | `GET /health` |
| Postgres | 5432 | `DATABASE_URL` → database `bugnote`, role `bugnote_app` |

## Invariants

- Isolated `bugnote` database only — never ResearchOne (see `.github/copilot-instructions.md`).
- Postgres job queue (`FOR UPDATE SKIP LOCKED`) — no Redis.
- Draft PRs only; no auto-merge; no repo clone on Emma.
- Per-report `AGENT_COST_BUDGET_USD` and `AGENT_CONFIDENCE_GATE`.

## Deployment

- **Server:** Emma VM, PM2 `bugnote-api` + `bugnote-worker` — see Document 3. API: `https://api.bugnote.intellme.com`.
- **Dashboard:** Vercel, root `apps/dashboard`. Production: `https://bugnote-intellme.vercel.app`. Vercel env: `VITE_API_BASE_URL`, `VITE_GOOGLE_OAUTH_CLIENT_ID`.
- **Merging PRs that touch `apps/server`** triggers Emma redeploy, not only Vercel.

## Manual E2E (Document 3 §6–7)

1. Widget on staging app → submit report.
2. Dashboard inbox shows report progressing.
3. Optional draft PR on mapped repo.

## Host app integration

Rollout checklist for ResearchOne, thenewontology, and other products: [`HOST_APP_INTEGRATION_PLAN.md`](HOST_APP_INTEGRATION_PLAN.md).

## Pre-PR review guards

See `.cursor/rules/40-pr-review-recurring-guards.mdc` and retrospectives:
- `docs/retrospectives/2026-06-03-pr3-codex-copilot-review.md` (PR #3)
- `docs/retrospectives/2026-06-03-pr5-codex-copilot-review.md` (PR #5 — OAuth allowlist, env naming)

## Admin auth audit (Clerk → Google)

| File | Reference | REPLACE / KEEP | Why |
|------|-----------|----------------|-----|
| `apps/server/src/api/auth.ts` | `verifyToken`, `@clerk/backend`, `CLERK_SECRET_KEY` | REPLACE | BugNote admin verifier |
| `apps/server/src/config/index.ts` | `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY` | REPLACE | Env schema |
| `apps/server/package.json` | `@clerk/backend` | REPLACE | Dependency |
| `apps/dashboard/src/main.tsx` | `ClerkProvider`, `SignedIn/Out`, `RedirectToSignIn`, `VITE_CLERK_*` | REPLACE | Sign-in gate |
| `apps/dashboard/src/api.ts` | `useAuth`, `getToken` | REPLACE | Bearer source + 401/403 handling |
| `apps/dashboard/src/App.tsx` | `UserButton` | REPLACE | Sign-out UX |
| `apps/dashboard/src/vite-env.d.ts` | `VITE_CLERK_PUBLISHABLE_KEY` | REPLACE | Vite env types |
| `apps/dashboard/package.json` | `@clerk/clerk-react` | REPLACE | Dependency |
| `.env.example` | `CLERK_*` | REPLACE | Local/deploy template |
| `docs/BugNote-Doc2-Cursor-Build-WO5.md` | Clerk snippets, acceptance bullets | REPLACE | Canonical build spec |
| `docs/BugNote-Doc3-Deployment-Guide.md` | §3.2 Clerk, §3.3/§4 Clerk env vars | REPLACE | Ops setup |
| `docs/BugNote-Doc3-Deployment-Guide.md` | `clerkUser?.id` in §6 widget example | KEEP | Host-app Clerk, not BugNote |
| `docs/BugNote-Doc2-Cursor-Build-WO3-WO4.md` | “Clerk-gated review dashboard” teaser | REPLACE | Wording only |
| `docs/agent/REPO_PROFILE.md` | “Clerk-gated”, “Vercel/Clerk setup” | REPLACE | Profile accuracy |
| `package-lock.json` | `@clerk/*` lock entries | REPLACE | Regenerated via `npm install` |
| `/opt/cursor/artifacts/plans/build_bugnote_app_be28aadd.plan.md` | WO-5 Clerk bullets | REPLACE | Agent build plan parity |
| `README.md`, `.github/copilot-instructions.md` | — | N/A | No Clerk references |
| `docs/BugNote-Doc2-Cursor-Build-WO1-WO2.md` | `getUserId` API only | KEEP | No Clerk reference |

## Agent notes

- PR branches: `cursor/<topic>-a484` via `bash scripts/git/prepare-work-branch.sh <slug> cursor/<slug>-a484`.
- Before commit: `bash scripts/git/assert-not-on-default-branch.sh`.
- Before PR: typecheck, build, test, `assert-no-test-mocks-in-app-src.sh`.
