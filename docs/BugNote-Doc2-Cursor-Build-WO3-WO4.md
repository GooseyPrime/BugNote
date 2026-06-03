# BugNote — Document 2 of 3 (Part 2: WO-3 & WO-4)

Continues the Cursor build spec. Same rules as Part 1. Implement in order; WO-3 fills the `runStage` stub from WO-2.

---

## WO-0b — Dossier contract (add to `packages/shared/src/index.ts`)

The dossier is the shared state object every pipeline stage reads and extends. It is persisted on the report row (`reports.dossier` jsonb) after each stage.

```ts
export const Confidence = z.number().min(0).max(1);

export const TriageResult = z.object({
  category: z.enum(["ui", "logic", "network", "data", "auth", "performance", "unknown"]),
  severity: Severity,
  componentHint: z.string().optional(),
  actionable: z.boolean(),
  reason: z.string(),
});
export type TriageResult = z.infer<typeof TriageResult>;

export const AnalysisResult = z.object({
  hypothesis: z.string(),
  suspectFiles: z.array(z.string()),         // repo-relative paths
  topFrame: z.object({ file: z.string().optional(), symbol: z.string().optional() }).optional(),
  confidence: Confidence,
});
export type AnalysisResult = z.infer<typeof AnalysisResult>;

export const FixProposal = z.object({
  summary: z.string(),
  diff: z.string(),                          // unified diff, for display only
  files: z.array(z.object({ path: z.string(), newContent: z.string() })), // full new contents, for committing
  confidence: Confidence,
});
export type FixProposal = z.infer<typeof FixProposal>;

export const Dossier = z.object({
  reportId: z.string(),
  appId: z.string(),
  repo: z.string().optional(),               // owner/repo from GITHUB_APP_REPO_MAP
  triage: TriageResult.optional(),
  analysis: AnalysisResult.optional(),
  retrievedFiles: z.array(z.object({ path: z.string(), content: z.string() })).optional(),
  fix: FixProposal.optional(),
  prUrl: z.string().optional(),
  costUsd: z.number().default(0),
  notes: z.array(z.string()).default([]),
  haltedReason: z.string().optional(),
});
export type Dossier = z.infer<typeof Dossier>;
```

> Note: `FixProposal.files` carries **full new file contents**, not just a patch. This lets WO-4 commit via the GitHub git-data API without applying diffs server-side. The `diff` field is kept purely for human display in the PR body and dashboard.

---

## WO-3 — Agent pipeline + OpenRouter client (`apps/server/src/agents`)

**Objective:** implement `runStage` as a five-stage chain — triage → analysis → investigate → fix → pr — that extends the dossier, enforces a per-report cost budget and a confidence gate, and **always stops at a draft PR**.

Each stage owns advancing the chain: on success it enqueues the next stage; on a gate-fail, budget halt, or "not actionable", it sets a terminal status and enqueues nothing.

### `apps/server/src/agents/openrouter.ts`
```ts
import { env } from "../config";

export type Content = string | Array<Record<string, unknown>>;
export interface ChatMessage { role: "system" | "user" | "assistant"; content: Content; }
export interface LlmResult { text: string; promptTokens: number; completionTokens: number; costUsd: number; }

// USD per 1M tokens. Override per model id as you settle on choices.
const PRICE: Record<string, { in: number; out: number }> = {
  default: { in: 1.0, out: 3.0 },
};

export async function chat(
  model: string,
  messages: ChatMessage[],
  opts?: { json?: boolean; maxTokens?: number },
): Promise<LlmResult> {
  if (!env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not set");
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "X-Title": "BugNote",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: opts?.maxTokens ?? 1500,
      ...(opts?.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  const data: any = await res.json();
  const text: string = data.choices?.[0]?.message?.content ?? "";
  const pt: number = data.usage?.prompt_tokens ?? 0;
  const ct: number = data.usage?.completion_tokens ?? 0;
  const p = PRICE[model] ?? PRICE.default;
  return { text, promptTokens: pt, completionTokens: ct, costUsd: (pt / 1e6) * p.in + (ct / 1e6) * p.out };
}

export function parseJson<T>(text: string): T {
  return JSON.parse(text.replace(/```json|```/g, "").trim()) as T;
}
```
For the vision call in the analysis stage, pass `content` as an array, e.g.:
```ts
[{ type: "text", text: "..." }, { type: "image_url", image_url: { url: screenshotUrlOrDataUrl } }]
```

### `apps/server/src/agents/guards.ts`
```ts
import { env } from "../config";
import type { Dossier } from "@bugnote/shared";

export class BudgetExceeded extends Error {}

export function chargeAndCheck(d: Dossier, costUsd: number): void {
  d.costUsd += costUsd;
  if (d.costUsd > env.AGENT_COST_BUDGET_USD) {
    throw new BudgetExceeded(`cost ${d.costUsd.toFixed(3)} > budget ${env.AGENT_COST_BUDGET_USD}`);
  }
}

export function passesGate(confidence: number): boolean {
  return confidence >= env.AGENT_CONFIDENCE_GATE;
}
```

### `apps/server/src/agents/dossier.ts` (spec + signatures)
```ts
import type { Dossier, ReportStatus } from "@bugnote/shared";
export async function loadDossier(reportId: string): Promise<{ report: any; dossier: Dossier }>;
export async function saveDossier(reportId: string, dossier: Dossier, status?: ReportStatus): Promise<void>;
```
- `loadDossier`: `SELECT *` the report; if `report.dossier` is null, init `{ reportId, appId, repo: GITHUB_APP_REPO_MAP[appId], costUsd:0, notes:[] }`.
- `saveDossier`: `UPDATE reports SET dossier=$1, status=COALESCE($2,status), updated_at=now()`. Also mirror `dossier.prUrl` → `reports.pr_url` when set.
- Wrap `BudgetExceeded` at the worker boundary: when a stage throws `BudgetExceeded`, persist `haltedReason` and set status `failed` — do **not** retry (catch it in `runStage` and swallow after persisting, so the queue marks the job done, not retried).

### `apps/server/src/agents/index.ts` (replaces the WO-2 stub)
```ts
import type { PipelineStage } from "@bugnote/shared";
import { BudgetExceeded } from "./guards";
import { loadDossier, saveDossier } from "./dossier";
import { triage } from "./stages/triage";
import { analysis } from "./stages/analysis";
import { investigate } from "./stages/investigate";
import { fix } from "./stages/fix";
import { pr } from "./stages/pr";

const STAGES: Record<PipelineStage, (id: string) => Promise<void>> = {
  triage, analysis, investigate, fix, pr,
};

export async function runStage(stage: PipelineStage, reportId: string): Promise<void> {
  try {
    await STAGES[stage](reportId);
  } catch (e) {
    if (e instanceof BudgetExceeded) {
      const { dossier } = await loadDossier(reportId);
      dossier.haltedReason = e.message;
      await saveDossier(reportId, dossier, "failed");
      return; // terminal — do not let the queue retry a budget halt
    }
    throw e; // genuine errors bubble to the worker for backoff/retry
  }
}
```

### `apps/server/src/agents/stages/triage.ts` (worked example — implement the rest to match)
```ts
import { env } from "../../config";
import { chat, parseJson } from "../openrouter";
import { chargeAndCheck } from "../guards";
import { loadDossier, saveDossier } from "../dossier";
import { enqueue } from "../../queue";
import { TriageResult } from "@bugnote/shared";

export async function triage(reportId: string) {
  const { report, dossier } = await loadDossier(reportId);

  const sys =
    "You are a bug triage agent. Reply ONLY with JSON: " +
    '{"category":"ui|logic|network|data|auth|performance|unknown","severity":"low|medium|high|critical",' +
    '"componentHint":"optional string","actionable":boolean,"reason":"short string"}';
  const user = JSON.stringify({
    note: report.note,
    errors: report.errors,
    breadcrumbs: report.breadcrumbs,
    route: report.context?.route ?? report.context?.url,
  });

  const r = await chat(env.OPENROUTER_MODEL_TRIAGE ?? "default",
    [{ role: "system", content: sys }, { role: "user", content: user }],
    { json: true, maxTokens: 400 });
  chargeAndCheck(dossier, r.costUsd);

  const result = TriageResult.parse(parseJson(r.text));
  dossier.triage = result;
  dossier.notes.push(`triage: ${result.category}/${result.severity}`);

  if (!result.actionable) {
    dossier.haltedReason = "not actionable";
    await saveDossier(reportId, dossier, "needs_info");
    return;
  }
  await saveDossier(reportId, dossier, "triaged");
  await enqueue(reportId, "analysis");
}
```

### Remaining stages (specs — same shape: load → call → charge → parse → persist → enqueue-or-halt)

**`stages/analysis.ts`** — model `OPENROUTER_MODEL_ANALYSIS` (vision-capable).
- Input: errors, console, breadcrumbs, note, and the screenshot (pass `screenshotUrl` if public, else fetch from Spaces and inline as a data URL) as an `image_url` content block.
- Output: `AnalysisResult` (hypothesis, suspectFiles, topFrame, confidence). Prompt it to derive `suspectFiles` from stack-trace paths where possible.
- Halt conditions: if `dossier.repo` is unset (no repo mapped for this app) → persist status `analyzed`, `haltedReason: "no repo mapped"`, stop. If `!passesGate(confidence)` → status `analyzed`, `haltedReason: "below confidence gate"`, stop.
- Else: status `analyzing` → enqueue `investigate`.

**`stages/investigate.ts`** — no LLM by default.
- Call `retrieveFiles(dossier.repo!, dossier.analysis!.suspectFiles)` (WO-4). If `suspectFiles` is empty, call `searchCode(repo, hypothesis-derived query)` first to find candidates (cap 10).
- Store `dossier.retrievedFiles`. If nothing retrieved → status `analyzed`, `haltedReason: "no files retrieved"`, stop.
- Else: status `investigating` → enqueue `fix`.

**`stages/fix.ts`** — model `OPENROUTER_MODEL_FIX` (strong reasoner).
- Input: hypothesis + each retrieved file (path + content).
- Output: `FixProposal` — instruct it to return, per touched file, the **complete new file content** plus an overall unified `diff` for display, plus `confidence`.
- Validate: every `files[].path` must be one of the retrieved paths (reject hallucinated paths). If `!passesGate(fix.confidence)` → persist the proposal, status `fix_proposed`, `haltedReason: "below confidence gate"`, stop (the diff is still visible in the dashboard for manual use).
- Else: status `fix_proposed` → enqueue `pr`.

**`stages/pr.ts`** — no LLM.
- Call `openDraftPr(dossier.repo!, dossier.fix!, report)` (WO-4). Set `dossier.prUrl`, persist status `pr_opened`. Terminal — enqueue nothing.

### WO-3 acceptance
- [ ] A report with an actionable error flows triage → analysis → investigate → fix → pr and ends `pr_opened` with a draft PR URL on the report row.
- [ ] Setting `AGENT_COST_BUDGET_USD` very low halts mid-run with status `failed` + `haltedReason`, and the job is **not** retried.
- [ ] A low-confidence analysis stops at `analyzed`; a low-confidence fix stops at `fix_proposed` with the diff stored — neither opens a PR.
- [ ] A report whose `appId` has no repo mapping stops at `analyzed` with `haltedReason: "no repo mapped"`.
- [ ] Hallucinated file paths in a fix are rejected before WO-4 is called.
- [ ] The dossier on the report row reflects every completed stage and the running `costUsd`.

---

## WO-4 — GitHub App: retrieval + draft PR (`packages/github-app`)

**Objective:** authenticate as the installed GitHub App, retrieve suspect files via the contents API (no clone), and open a draft PR by committing full file contents through the git-data API. **Never** push to a default branch; **never** merge.

### `packages/github-app/src/octokit.ts`
```ts
import { App } from "@octokit/app";
import { env } from "./env"; // mirror server env loader for GITHUB_APP_* + GITHUB_APP_REPO_MAP

const app = new App({ appId: env.GITHUB_APP_ID, privateKey: env.GITHUB_APP_PRIVATE_KEY });

export async function installationOctokit(repo: string) {
  const [owner, name] = repo.split("/");
  // Resolve the installation for this repo, then return an installation-scoped client.
  const { data: inst } = await app.octokit.request(
    "GET /repos/{owner}/{repo}/installation", { owner, repo: name },
  );
  return app.getInstallationOctokit(inst.id);
}
```

### `packages/github-app/src/retrieve.ts`
```ts
import { installationOctokit } from "./octokit";

const MAX_FILES = 10;
const MAX_BYTES = 64 * 1024;

export async function retrieveFiles(repo: string, paths: string[]) {
  const [owner, name] = repo.split("/");
  const octokit = await installationOctokit(repo);
  const out: Array<{ path: string; content: string }> = [];
  for (const path of paths.slice(0, MAX_FILES)) {
    try {
      const { data } = await octokit.rest.repos.getContent({ owner, repo: name, path });
      if (!Array.isArray(data) && data.type === "file" && data.size <= MAX_BYTES) {
        out.push({ path, content: Buffer.from(data.content, "base64").toString("utf-8") });
      }
    } catch { /* 404 / not a file — skip */ }
  }
  return out;
}

export async function searchCode(repo: string, query: string) {
  const octokit = await installationOctokit(repo);
  const { data } = await octokit.rest.search.code({ q: `${query} repo:${repo}`, per_page: 10 });
  return data.items.map((i) => i.path);
}
```

### `packages/github-app/src/pr.ts`
```ts
import { installationOctokit } from "./octokit";
import type { FixProposal } from "@bugnote/shared";

export async function openDraftPr(
  repo: string,
  fix: FixProposal,
  report: { id: string },
): Promise<string> {
  const [owner, name] = repo.split("/");
  const octokit = await installationOctokit(repo);

  const { data: repoInfo } = await octokit.rest.repos.get({ owner, repo: name });
  const base = repoInfo.default_branch;
  const { data: baseRef } = await octokit.rest.git.getRef({ owner, repo: name, ref: `heads/${base}` });
  const baseSha = baseRef.object.sha;
  const { data: baseCommit } = await octokit.rest.git.getCommit({ owner, repo: name, commit_sha: baseSha });

  const tree = await Promise.all(fix.files.map(async (f) => {
    const { data: blob } = await octokit.rest.git.createBlob({
      owner, repo: name, content: f.newContent, encoding: "utf-8",
    });
    return { path: f.path, mode: "100644" as const, type: "blob" as const, sha: blob.sha };
  }));

  const { data: newTree } = await octokit.rest.git.createTree({
    owner, repo: name, base_tree: baseCommit.tree.sha, tree,
  });
  const { data: commit } = await octokit.rest.git.createCommit({
    owner, repo: name,
    message: `fix: ${fix.summary}\n\nBugNote report ${report.id}`,
    tree: newTree.sha, parents: [baseSha],
  });

  const branch = `bugnote/${report.id.slice(0, 8)}`;
  await octokit.rest.git.createRef({ owner, repo: name, ref: `refs/heads/${branch}`, sha: commit.sha });

  const body = [
    `Automated **draft** from BugNote for report \`${report.id}\`.`,
    "", `**Summary:** ${fix.summary}`,
    "", `**Confidence:** ${fix.confidence}`,
    "", "```diff", fix.diff, "```",
    "", "_Review carefully. Tests run on this PR's CI, not on the host VM._",
  ].join("\n");

  const { data: pull } = await octokit.rest.pulls.create({
    owner, repo: name, head: branch, base, draft: true,
    title: `[BugNote] ${fix.summary}`.slice(0, 80), body,
  });
  return pull.html_url;
}
```

### `packages/github-app/src/index.ts`
```ts
export { retrieveFiles, searchCode } from "./retrieve";
export { openDraftPr } from "./pr";
```

### WO-4 acceptance
- [ ] With the App installed on a test repo and `GITHUB_APP_REPO_MAP` mapping the app, `retrieveFiles` returns decoded contents for valid paths and silently skips 404s.
- [ ] `openDraftPr` creates a new branch `bugnote/<id>`, a single commit on top of the default branch, and a **draft** PR linking the report — without touching the default branch.
- [ ] The App's permissions are minimal: Contents (read/write) + Pull requests (write). No admin, no merge.
- [ ] Re-running for the same report id is idempotent or fails cleanly (branch-exists handled, not a crash).

---

## Next

Part 3 implements **WO-5** — the Google OAuth (single-admin) review dashboard (per-app inboxes, report detail with screenshot + console/breadcrumb trail + dossier + proposed diff + PR link, and triage actions). Then Document 3 is the deployment guide for you.
