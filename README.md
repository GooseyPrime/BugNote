# BugNote

Embeddable bug-capture SDK + agentic auto-remediation backend.

- `packages/widget` — embeddable SDK (npm + UMD)
- `apps/server` — ingest API + agent pipeline worker (deploys to Emma via GitHub Actions)
- `apps/dashboard` — review console (deploys to Vercel)
- `packages/github-app` — file retrieval + draft PR generation
- `packages/shared` — zod schemas + shared types

See the three setup documents for the full build and deploy plan.
Runs in an isolated lane on the Emma VM. Never references ResearchOne data.
