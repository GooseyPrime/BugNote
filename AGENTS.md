# Agent rules for this repository

This file is the entry point for AI coding agents. It is intentionally portable.
Before changing code in any repository, agents must learn the local project shape,
then apply the durable operating rules in `.cursor/rules/`.

## Binding branch workflow

Unless the user explicitly authorizes a direct default-branch change in the same
request, all implementation work must happen on a PR branch.

1. Before any file edit, run:

   ```bash
   git fetch origin
   bash scripts/git/prepare-work-branch.sh <topic-slug>
   ```

2. Commit on that branch, push it, and open or update a PR into the default
   branch.
3. Never push scoped implementation work directly to `main`, `master`, or the
   repository default branch without same-request authorization.
4. If direct default-branch work is explicitly authorized, the commit message
   must include `[direct-main]`.
5. When work is finished, report the PR link and the exact merge instruction:
   `Merge PR #N to ship.`

Enforcement files:

- `scripts/git/assert-not-on-default-branch.sh`
- `scripts/git/prepare-work-branch.sh`
- `scripts/git/install-pre-commit-hook.sh`
- `scripts/ci/assert-default-branch-push-authorized.sh`
- `.github/workflows/ci-agent-guards.yml`
- `.github/workflows/ci-default-branch-push-gate.yml`

## Required first read

Read `.cursor/rules/00-pre-commit-review.mdc` before starting any work. It is the
master checklist and links to the topic-specific rules.

## Self-assimilation protocol

Before editing a new or unfamiliar repository, the agent must identify and record
or summarize:

1. Repository topology: app folders, packages, workspaces, scripts, deployment
   entry points, and generated artifacts.
2. Source-of-truth docs: README files, architecture docs, runbooks, schemas,
   API specs, domain policy docs, and environment examples.
3. Build and test commands: lint, typecheck, unit tests, integration tests,
   migrations, seed scripts, e2e tests, and production build.
4. Runtime dependencies: databases, queues, caches, object storage, auth,
   billing, third-party APIs, local services, Docker Compose profiles, and ports.
5. Data ownership and safety invariants: tenant isolation, permissions, RLS,
   admin overrides, audit logs, idempotency, and privacy boundaries.
6. Deployment model: host, branch-to-deploy behavior, environment variables,
   release gates, health checks, rollback path, and migrations.
7. Known fragile areas: recent incidents, TODOs, failing tests, flaky suites,
   deferred features, and code review findings.

Use `docs/agent/REPO_PROFILE.template.md` as the portable project profile. If the
repo already has a stronger profile, treat that local profile as the source of
truth and update it instead of creating a duplicate.

## Rule index

| File | Topic |
|---|---|
| `.cursor/rules/00-pre-commit-review.mdc` | Master checklist. Always read before staging. |
| `.cursor/rules/10-state-machine-and-multi-writer.mdc` | Single-writer/single-reader discipline for state. |
| `.cursor/rules/11-error-paths-and-logging.mdc` | Preserve diagnostics and callback severity when changing error paths. |
| `.cursor/rules/12-event-window-math.mdc` | Prevent capped-buffer and newest/oldest ordering mistakes. |
| `.cursor/rules/13-deploy-skew-and-schema.mdc` | Tolerate schema skew and keep fallback writes equivalent. |
| `.cursor/rules/14-third-party-api-contracts.mdc` | Verify external API/library contracts before calling them. |
| `.cursor/rules/15-doc-pr-and-code-parity.mdc` | Keep docs, PR descriptions, screenshots, and code in sync. |
| `.cursor/rules/16-tests-must-fail-without-the-fix.mdc` | Tests must actually catch the regression. |
| `.cursor/rules/17-ripple-and-grep-callers.mdc` | Grep every caller when changing primitives. |
| `.cursor/rules/20-domain-policy-guardrails.mdc` | Respect domain policy, safety, compliance, and high-stakes defaults. |
| `.cursor/rules/21-identity-billing-webhook-contracts.mdc` | Auth, billing, subscription, webhook, metadata, and idempotency contracts. |
| `.cursor/rules/22-out-of-scope-discovery.mdc` | Handle nearby findings without silently burying them. |
| `.cursor/rules/23-early-return-resource-cleanup.mdc` | Early exits must clean up staged resources. |
| `.cursor/rules/24-canonical-path-after-mutation.mdc` | Update all references after moving, deleting, compressing, or renaming files. |
| `.cursor/rules/25-cost-usage-and-unit-economics.mdc` | Usage/cost telemetry must be scoped, idempotent, and auditable. |
| `.cursor/rules/26-public-page-persona-and-visual-contracts.mdc` | Public UI, persona routing, analytics, and visual contract discipline. |
| `.cursor/rules/27-animated-process-visuals.mdc` | Animated process diagrams must match real states and accessibility rules. |
| `.cursor/rules/28-export-and-formatting-engine.mdc` | Export, formatting, citations, and generated-document contracts. |
| `.cursor/rules/29-scope-doc-and-a11y-contracts.mdc` | Contract-style scope docs, accessibility gates, and implementation parity. |
| `.cursor/rules/30-hosting-routing-and-prerender.mdc` | SPA rewrites, prerendering, API routes, sitemap, and CSP hygiene. |
| `.cursor/rules/31-public-copy-vocabulary.mdc` | Public copy must use precise, user-facing vocabulary. |
| `.cursor/rules/32-pr-branch-workflow.mdc` | PR branch workflow; default-branch pushes are break-glass only. |
| `.cursor/rules/33-canonical-read-models.mdc` | Use canonical read services/views for list/detail shapes. |
| `.cursor/rules/34-plan-confirmation-gate.mdc` | No irreversible side effects before explicit confirmation. |
| `.cursor/rules/35-url-sync-live-polling-and-reopen.mdc` | URL state, sockets, polling, and reopen/hydration flows. |
| `.cursor/rules/36-revision-fork-lineage-and-timeline.mdc` | Revision/fork/spinoff lineage and timeline consistency. |
| `.cursor/rules/37-two-audience-copy.mdc` | Plain-language surfaces vs technical-depth surfaces. |
| `.cursor/rules/38-runtime-process-and-bootstrap-secrets.mdc` | Runtime processes must not inherit bootstrap-only secrets. |
| `.cursor/rules/39-repo-self-assimilation.mdc` | How agents adapt this regimen to a new repository. |

## Production source: no test mocks

Application source must not ship test harness APIs such as `vi.mock`, `vi.fn`,
`jest.mock`, or `jest.fn`. Mocks belong in test files, fixtures, local harnesses,
or clearly excluded directories.

Generic enforcement is provided by:

```bash
bash scripts/ci/assert-no-test-mocks-in-app-src.sh
```

By default it scans common source folders. Override with:

```bash
APP_SRC_DIRS="backend/src frontend/src packages/app/src" \
  bash scripts/ci/assert-no-test-mocks-in-app-src.sh
```

## When to involve the user

Do not stop routine work for permission to begin. Escalate only when:

- Same-request direct default-branch authorization is required but absent.
- You cannot open or update a PR.
- Required secrets, private systems, or credentials are unavailable.
- The requested task conflicts with a documented invariant.
- Tests or deployment gates fail for reasons outside the requested change.

Use a short escalation block:

```text
Blocked: <one-line reason>
Safe options:
A) <preferred safe path>
B) <alternate path, if any>
Needed from you: <specific action or authorization>
```

## Rule maintenance

When a review finding reveals a recurring bug class, add it to the closest rule
or create a new rule. These files are living operating memory, not decoration.
