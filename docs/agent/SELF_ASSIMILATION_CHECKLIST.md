# Agent self-assimilation checklist

Use this when entering a repository for the first time or after a long gap.

## 1. Map the repository

- [ ] Top-level tree inspected.
- [ ] Root README read.
- [ ] `AGENTS.md` read.
- [ ] `.cursor/rules/00-pre-commit-review.mdc` read.
- [ ] Existing architecture/runbook/policy docs found.
- [ ] Workspaces/packages identified.
- [ ] Generated/vendor directories identified.

## 2. Map commands

- [ ] Install command identified.
- [ ] Lint command identified.
- [ ] Typecheck command identified.
- [ ] Unit test command identified.
- [ ] Integration/e2e test command identified if present.
- [ ] Build command identified.
- [ ] Migration command identified if present.

## 3. Map runtime

- [ ] Local services identified.
- [ ] Ports identified.
- [ ] Env examples identified.
- [ ] Required secrets identified without exposing values.
- [ ] Health/readiness path identified.

## 4. Map invariants

- [ ] Auth and permission model identified.
- [ ] Tenant/user ownership model identified.
- [ ] Billing/quota model identified if present.
- [ ] Data retention/privacy rules identified.
- [ ] Public copy/pricing/security claims identified.
- [ ] Deployment branch/host behavior identified.

## 5. Before editing

- [ ] PR branch prepared.
- [ ] Touched subsystem named.
- [ ] Ripple search terms listed.
- [ ] Relevant rules identified.
- [ ] Focused verification command selected.
