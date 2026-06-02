# BugNote — Repository Governance

These rules bind every agent (Copilot, Cursor) and every PR in this repo.

## Isolation invariants (highest priority)
1. BugNote runs in an isolated lane on the shared Emma VM. Code MUST NOT reference,
   connect to, or assume access to ResearchOne's database, role, files, or secrets.
   The only database is `bugnote`, accessed only as role `bugnote_app` via DATABASE_URL.
2. No Redis, no pgmq, no pgvector. The job queue is a Postgres table polled with
   `FOR UPDATE SKIP LOCKED`. Do not introduce a broker or extension.

## Auto-remediation safety (highest priority)
3. The agent pipeline NEVER auto-merges and NEVER pushes to a default branch.
   Every generated PR is opened as a DRAFT against a new branch, for human review.
4. The worker NEVER clones a target repo or runs its tests on Emma. Retrieve only the
   suspect files via the GitHub contents API. Validation of the patch (tests) happens
   on the target repo's own CI against the draft PR.
5. Respect the per-report cost budget (AGENT_COST_BUDGET_USD) and the confidence gate
   (AGENT_CONFIDENCE_GATE). Below the gate, stop at analysis and attach a note — never
   fabricate a fix or a PR.

## Secrets
6. No secret, key, token, or password in source or committed config. All config comes
   from `.env`, which is populated from GitHub Secrets at deploy time.

## Engineering standards
7. TypeScript strict everywhere. No `any` without a written justification comment.
8. All cross-package contracts (report payload, dossier, stage I/O) live in
   `@bugnote/shared` as zod schemas; infer types from the schemas.
9. Fail loud, never silent: every async boundary has error handling and structured
   `pino` logging. No empty catch blocks.
10. Atomic commits with clear messages. One logical change per commit.
11. Keep the widget's capture instrumentation installed at load (ring buffer), never
    only on click — see Document 2, WO-1.
