# Retrospective: PR #3 Codex + Copilot review themes

**Date:** 2026-06-03  
**PR:** [#3](https://github.com/GooseyPrime/BugNote/pull/3)  
**Detection:** Automated PR review (Codex P1/P2, Copilot inline)

## Recurring themes (pre-review guardrails)

| Theme | Impact | Pre-review check |
|-------|--------|------------------|
| **Private artifact keys ≠ public URLs** | LLM vision / external APIs get invalid `image_url` when DB stores S3 object keys | Grep `image_url` / OpenRouter payloads; sign or inline only at boundary |
| **Status before side effect** | Rows show `queued` with no `jobs` row after crash | Enqueue (or create job) before updating status that implies work exists |
| **Admin writes without Zod** | Invalid enum strings corrupt `reports.status` / crash worker | `ReportStatus.safeParse` / `PipelineStage.safeParse` on all admin mutators |
| **`import type` on Zod schemas** | `.safeParse` missing at runtime; validation silently absent | Value-import shared enums used for validation |
| **Unbounded query params** | `LIMIT NaN` / huge scans | Cap and sanitize numeric query params with defaults |
| **Underestimated LLM cost** | Budget gate fires too late | Prefer OpenRouter cost header / `usage.total_cost`; per-model fallback table |
| **UI label vs API contract** | Operators click “resolved” but set `needs_info` | Button copy must match `ReportStatus` values in shared schema |
| **Duplicate workspace deps** | Redundant lockfile noise | No same package in `dependencies` and `devDependencies` |

## Findings addressed in PR #3 follow-up

1. **Screenshot key → signed URL** in `analysis.ts` (Codex P1) — fixed.
2. **Enqueue before `queued` status** in `ingest.ts` (Codex P2) — fixed.
3. **Admin status/retry validation + limit cap** (Copilot) — fixed.
4. **OpenRouter cost** header + per-model fallback (Copilot) — fixed.
5. **Dashboard button label** (Copilot) — fixed.
6. **Widget duplicate `@bugnote/shared`** (Copilot) — fixed.

## Rule updates

- Added [`.cursor/rules/40-pr-review-recurring-guards.mdc`](../.cursor/rules/40-pr-review-recurring-guards.mdc) (requestable + linked from `REPO_PROFILE.md`).

## Regression tests

- Existing integration tests cover ingest/queue; consider adding admin 400 tests for invalid status/stage in a follow-up.
