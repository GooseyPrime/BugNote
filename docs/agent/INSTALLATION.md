# Portable Cursor Agent Kit - installation

This kit is designed to be copied into any Git repository that uses Cursor agents
or other AI coding agents.

## Install into a repository

From the extracted kit root:

```bash
cp -R AGENTS.md .cursor scripts .github docs /path/to/target-repo/
cd /path/to/target-repo
bash scripts/git/install-pre-commit-hook.sh
bash scripts/agent/inspect-repo.sh
```

Then create the local profile:

```bash
mkdir -p docs/agent
cp docs/agent/REPO_PROFILE.template.md docs/agent/REPO_PROFILE.md
```

Fill `docs/agent/REPO_PROFILE.md` with facts from the repository. Do not invent
commands, hosts, secrets, or architecture details.

## Expected agent entry sequence

1. Read `AGENTS.md`.
2. Read `.cursor/rules/00-pre-commit-review.mdc`.
3. Read `docs/agent/REPO_PROFILE.md` or create it from the template.
4. Prepare a PR branch with `scripts/git/prepare-work-branch.sh`.
5. Make the requested change.
6. Run the relevant checks.
7. Push a PR branch and tell the user exactly what to merge.

## Optional configuration

### Application source directories

The no-mocks CI guard scans common source directories by default. Override:

```bash
APP_SRC_DIRS="backend/src frontend/src packages/app/src" \
  bash scripts/ci/assert-no-test-mocks-in-app-src.sh
```

### Public copy jargon guard

Populate these files if the project wants public-copy terminology checks:

- `docs/public-copy/public-copy-manifest.txt`
- `docs/public-copy/banned-public-jargon.txt`

The guard skips when those files have no active entries.

### Default branch

The git scripts auto-detect the remote default branch. Override when needed:

```bash
DEFAULT_BRANCH=main bash scripts/git/prepare-work-branch.sh my-topic
```
