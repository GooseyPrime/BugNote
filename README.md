# BugNote

Embeddable bug-capture SDK + agentic auto-remediation backend.

- `packages/widget` — embeddable SDK (npm + UMD)
- `apps/server` — ingest API + agent pipeline worker (deploys to Emma via GitHub Actions)
- `apps/dashboard` — review console (deploys to Vercel)
- `packages/github-app` — file retrieval + draft PR generation
- `packages/shared` — zod schemas + shared types

See Document 2 (build specs in `docs/BugNote-Doc2-Cursor-Build-*.md`) and [Document 3](docs/BugNote-Doc3-Deployment-Guide.md) for deployment and onboarding.
Runs in an isolated lane on the Emma VM. Never references ResearchOne data.
