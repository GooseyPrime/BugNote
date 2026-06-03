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
| Dashboard | `apps/dashboard` | Clerk-gated review console (Vercel) |
| Migrations | `apps/server/drizzle` | Postgres schema |
| Deploy | `ecosystem.config.cjs`, `scripts/deploy-runtime.sh` | PM2 on Emma |
| Ops guide | `docs/BugNote-Doc3-Deployment-Guide.md` | Emma/Vercel/Clerk setup |

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

- **Server:** Emma VM, PM2 `bugnote-api` + `bugnote-worker` — see Document 3.
- **Dashboard:** Vercel, root `apps/dashboard`.
- **Merging PRs that touch `apps/server`** triggers Emma redeploy, not only Vercel.

## Manual E2E (Document 3 §6–7)

1. Widget on staging app → submit report.
2. Dashboard inbox shows report progressing.
3. Optional draft PR on mapped repo.

## Pre-PR review guards

See `.cursor/rules/40-pr-review-recurring-guards.mdc` and `docs/retrospectives/2026-06-03-pr3-codex-copilot-review.md` (themes from Codex/Copilot on PR #3).

## Agent notes

- PR branches: `cursor/<topic>-a484` via `bash scripts/git/prepare-work-branch.sh <slug> cursor/<slug>-a484`.
- Before commit: `bash scripts/git/assert-not-on-default-branch.sh`.
- Before PR: typecheck, build, test, `assert-no-test-mocks-in-app-src.sh`.
