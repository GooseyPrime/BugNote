# Repository profile

Keep this file factual. Agents should update it when repository structure,
commands, deployment, or invariants change.

## Repository identity

- Repository name:
- Product/application name:
- Primary owner/team:
- Default branch:
- Production branch/deploy trigger:

## Topology

| Area | Path | Purpose | Notes |
|---|---|---|---|
| Frontend |  |  |  |
| Backend/API |  |  |  |
| Shared packages |  |  |  |
| Workers/jobs |  |  |  |
| Database/migrations |  |  |  |
| Infrastructure/deploy |  |  |  |
| Tests |  |  |  |
| Generated files |  |  | Do not hand-edit unless documented. |

## Package managers and commands

| Scope | Directory | Install | Lint | Typecheck | Test | Build | Notes |
|---|---|---|---|---|---|---|---|
| Root |  |  |  |  |  |  |  |
| Frontend |  |  |  |  |  |  |  |
| Backend |  |  |  |  |  |  |  |

## Local services

| Service | How to start | Port | Health check | Notes |
|---|---|---:|---|---|
| Database |  |  |  |  |
| Cache/queue |  |  |  |  |
| Object storage |  |  |  |  |

## Environment files and secrets

| File/secret | Used by | Required locally? | Notes |
|---|---|---|---|
| `.env.example` |  |  |  |

Never paste real secrets into this file.

## Deployment

- Host/platform:
- Services/apps:
- Build command:
- Start command:
- Migration command:
- Health/readiness endpoints:
- Rollback procedure:

## Data and permission invariants

- Tenant/user ownership model:
- Admin/support override model:
- RLS/policy layer:
- Data retention/deletion/export rules:
- Audit/logging requirements:

## Billing, quotas, or metering

- Billing provider:
- Plans/tiers:
- Entitlement source of truth:
- Webhook endpoints:
- Idempotency/reconciliation notes:

## Domain policy and high-stakes behavior

- Binding policy docs:
- Protected defaults:
- External claims requiring live verification:
- Safety/compliance restrictions:

## Known fragile areas

| Area | Risk | How to verify |
|---|---|---|
|  |  |  |

## Deferred or not-yet-live features

| Feature | Status | Public copy rule |
|---|---|---|
|  |  |  |

## Agent notes

- Correct branch workflow:
- Correct PR/merge instruction:
- Commands to run before PR:
- Files/directories not to edit:
