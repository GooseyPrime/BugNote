# Retrospective: PR #5 Codex + Copilot review themes

**Date:** 2026-06-03  
**PR:** [#5](https://github.com/GooseyPrime/BugNote/pull/5) — Clerk → Google OAuth admin auth  
**Detection:** Copilot inline review (2 comments). Codex: no separate inline findings on this PR (summary-only / pass).

## Recurring themes (pre-review guardrails)

| Theme | Impact | Pre-review check |
|-------|--------|------------------|
| **Comma-separated allowlists** | Trailing comma or empty segment can admit `""` and match tokens with no email | `.split(",").map(trim).filter(Boolean)`; require non-empty normalized email before allowlist check |
| **Auth guard branch coverage** | `email_verified` false could regress without test | Unit-test each conjunct in `requireAuth` (missing token, invalid token, unverified, missing email, wrong email, success) |
| **Vite env name drift** | Production uses `VITE_API_BASE_URL` while code/docs say `VITE_API_BASE` → silent `undefined` API host | Grep repo for deprecated name; CI `scripts/ci/assert-vite-api-base-url.sh` |

## Findings addressed in PR #5 follow-up

1. **Allowlist empty-string bypass** (Copilot) — `filter(Boolean)` + explicit `!email` check in `auth.ts`.
2. **`email_verified: false` untested** (Copilot) — added 403 test; added missing-email 403 test.
3. **`VITE_API_BASE` → `VITE_API_BASE_URL`** (operator / prior thread) — dashboard + docs + CI grep guard.

## Rule updates

- Extended [`.cursor/rules/40-pr-review-recurring-guards.mdc`](../.cursor/rules/40-pr-review-recurring-guards.mdc) with auth-allowlist and env-naming checks.

## Codex note

No Codex-specific inline recommendations were present on PR #5 beyond the Copilot review thread. Re-run Codex after merge if org policy requires a second pass on `main`.
