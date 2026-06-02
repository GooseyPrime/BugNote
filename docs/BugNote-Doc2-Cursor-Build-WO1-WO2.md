# BugNote — Document 2 of 3 (Part 1: WO-1 & WO-2)

## Cursor Build Spec

**Audience:** Cursor (implementation agent), working against the scaffold from Document 1.
**Rules:** obey `.github/copilot-instructions.md`. TypeScript strict, zod-first contracts, atomic commits, fail-loud. Implement work orders **in order**. Each WO ends with acceptance criteria — do not advance until they pass.

This part covers the shared contracts, **WO-1 (widget SDK)**, and **WO-2 (ingest API + queue)**. WO-3/4/5 follow in Part 2.

---

## WO-0 — Shared contracts

**File:** `packages/shared/src/index.ts` (replace placeholder)

These zod schemas are the single source of truth for everything that crosses a package or network boundary. Infer all types from them; never hand-declare a parallel interface.

```ts
import { z } from "zod";

export const Severity = z.enum(["low", "medium", "high", "critical"]);
export type Severity = z.infer<typeof Severity>;

export const ConsoleEntry = z.object({
  level: z.enum(["log", "info", "warn", "error", "debug"]),
  ts: z.number(),                  // epoch ms
  args: z.array(z.string()),       // stringified + scrubbed in the browser
});
export type ConsoleEntry = z.infer<typeof ConsoleEntry>;

export const ErrorEntry = z.object({
  ts: z.number(),
  kind: z.enum(["error", "unhandledrejection"]),
  name: z.string(),
  message: z.string(),
  stack: z.string().optional(),
  source: z.string().optional(),
  line: z.number().optional(),
  col: z.number().optional(),
});
export type ErrorEntry = z.infer<typeof ErrorEntry>;

export const Breadcrumb = z.object({
  ts: z.number(),
  type: z.enum(["click", "navigation", "fetch", "xhr", "custom"]),
  message: z.string(),
  data: z.record(z.string()).optional(),
});
export type Breadcrumb = z.infer<typeof Breadcrumb>;

export const CaptureContext = z.object({
  url: z.string(),
  route: z.string().optional(),
  userAgent: z.string(),
  viewport: z.object({ w: z.number(), h: z.number() }),
  appVersion: z.string().optional(),
  userId: z.string().optional(),
  sessionId: z.string(),
});
export type CaptureContext = z.infer<typeof CaptureContext>;

export const BugReportPayload = z.object({
  appId: z.string().min(1),
  severity: Severity.default("medium"),
  note: z.string().max(5000).optional(),
  context: CaptureContext,
  console: z.array(ConsoleEntry).max(100),
  errors: z.array(ErrorEntry).max(50),
  breadcrumbs: z.array(Breadcrumb).max(50),
  screenshotBase64: z.string().optional(), // small inline PNG; large ones go multipart
});
export type BugReportPayload = z.infer<typeof BugReportPayload>;

export const ReportStatus = z.enum([
  "received", "queued", "triaged", "analyzing", "analyzed",
  "investigating", "fix_proposed", "pr_opened", "needs_info",
  "duplicate", "failed",
]);
export type ReportStatus = z.infer<typeof ReportStatus>;

export const PipelineStage = z.enum([
  "triage", "analysis", "investigate", "fix", "pr",
]);
export type PipelineStage = z.infer<typeof PipelineStage>;
```

**Acceptance:** `npm run build -w packages/shared` emits `dist/index.js` + `.d.ts`; importing `BugReportPayload` from `@bugnote/shared` typechecks in `apps/server`.

---

## WO-1 — Embeddable widget SDK (`packages/widget`)

**Objective:** a resident floating button that, on click, presents a modal pre-loaded with a screenshot, the buffered console/error/breadcrumb trail, and an optional note, then POSTs a `BugReportPayload`. Ships as both an npm ESM package and a UMD `<script>` global.

### The load-bearing rule
Instrumentation installs **at load**, not on click. By the time a user notices a problem and clicks, the error event is already gone. Buffer continuously into fixed-size ring buffers; the click just snapshots them.

### `packages/widget/src/scrub.ts`
Redact obvious secrets in the browser before anything is buffered or sent.
```ts
const RULES: Array<[RegExp, string]> = [
  [/\beyJ[A-Za-z0-9._-]{20,}/g, "[jwt]"],                          // JWTs
  [/\b(sk|pk|rk)-[A-Za-z0-9]{16,}/g, "[apikey]"],                  // sk-/pk- style keys
  [/\bgh[pousr]_[A-Za-z0-9]{20,}/g, "[ghtoken]"],                  // GitHub tokens
  [/((?:authorization|api[_-]?key|token|secret|password)\s*[:=]\s*)("?)[^"'\s,}]{6,}/gi, '$1[redacted]'],
];
export function scrubString(s: string): string {
  let out = s;
  for (const [re, rep] of RULES) out = out.replace(re, rep);
  return out.length > 2000 ? out.slice(0, 2000) + "…" : out;
}
```

### `packages/widget/src/buffer.ts`
```ts
import type { Breadcrumb, ConsoleEntry, ErrorEntry } from "@bugnote/shared";
import { scrubString } from "./scrub";

class Ring<T> {
  private buf: T[] = [];
  constructor(private max: number) {}
  push(x: T) { this.buf.push(x); if (this.buf.length > this.max) this.buf.shift(); }
  snapshot() { return [...this.buf]; }
}

const logs = new Ring<ConsoleEntry>(100);
const errs = new Ring<ErrorEntry>(50);
const crumbs = new Ring<Breadcrumb>(50);
let installed = false;

function stringify(a: unknown): string {
  if (typeof a === "string") return a;
  try { return JSON.stringify(a); } catch { return String(a); }
}
function describe(el: HTMLElement): string {
  const id = el.id ? `#${el.id}` : "";
  const cls = typeof el.className === "string" && el.className ? `.${el.className.split(/\s+/)[0]}` : "";
  const text = (el.textContent ?? "").trim().slice(0, 40);
  return `${el.tagName.toLowerCase()}${id}${cls}${text ? ` "${text}"` : ""}`;
}

export function install() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  (["log", "info", "warn", "error", "debug"] as const).forEach((level) => {
    const orig = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      try { logs.push({ level, ts: Date.now(), args: args.map((a) => scrubString(stringify(a))) }); } catch {}
      orig(...args);
    };
  });

  window.addEventListener("error", (e) => {
    errs.push({
      ts: Date.now(), kind: "error",
      name: (e.error?.name as string) ?? "Error",
      message: scrubString(e.message ?? String(e.error)),
      stack: e.error?.stack ? scrubString(e.error.stack) : undefined,
      source: e.filename, line: e.lineno, col: e.colno,
    });
  });

  window.addEventListener("unhandledrejection", (e) => {
    const r: any = e.reason;
    errs.push({
      ts: Date.now(), kind: "unhandledrejection",
      name: r?.name ?? "UnhandledRejection",
      message: scrubString(r?.message ?? stringify(r)),
      stack: r?.stack ? scrubString(r.stack) : undefined,
    });
  });

  window.addEventListener("click", (e) => {
    const t = e.target as HTMLElement | null;
    if (t) crumbs.push({ ts: Date.now(), type: "click", message: describe(t) });
  }, { capture: true });

  const nav = (url: string) => crumbs.push({ ts: Date.now(), type: "navigation", message: url });
  ["pushState", "replaceState"].forEach((m) => {
    const orig = (history as any)[m];
    (history as any)[m] = function (...a: any[]) { const r = orig.apply(this, a); nav(location.href); return r; };
  });
  window.addEventListener("popstate", () => nav(location.href));

  const origFetch = window.fetch;
  window.fetch = async (...a) => {
    try {
      const res = await origFetch(...a);
      if (!res.ok) crumbs.push({ ts: Date.now(), type: "fetch", message: `${res.status} ${String(a[0])}` });
      return res;
    } catch (err) {
      crumbs.push({ ts: Date.now(), type: "fetch", message: `failed ${String(a[0])}` });
      throw err;
    }
  };
}

export function snapshot() {
  return { console: logs.snapshot(), errors: errs.snapshot(), breadcrumbs: crumbs.snapshot() };
}
```

### `packages/widget/src/capture.ts` (spec + signature)
```ts
import html2canvas from "html2canvas";
import type { CaptureContext } from "@bugnote/shared";
export async function captureScreenshot(): Promise<string>; // returns PNG data URL; downscale to max 1280px wide, quality-compress
export function captureContext(getUserId?: () => string | undefined, appVersion?: string): CaptureContext;
```
- `captureScreenshot`: `html2canvas(document.body, { logging:false, useCORS:true, scale: Math.min(1, 1280/window.innerWidth) })` → `canvas.toDataURL("image/png")`. Wrap in try/catch; on failure return empty string (report still sends without a screenshot).
- `captureContext`: build from `location`, `navigator.userAgent`, `window.innerWidth/Height`; `sessionId` is a per-tab UUID stored in `sessionStorage` under `bn_sid`.

### `packages/widget/src/ui.ts` (spec)
Implement with **vanilla DOM** (no framework dependency in the core), all styles inline or in a single injected `<style id="bugnote-style">`, shadow-DOM hosted so host CSS can't bleed in.
- `renderButton(cfg)`: a fixed-position pill button (configurable corner) with a small bug glyph. On click → `openModal(cfg)`.
- `openModal(cfg)`: immediately calls `captureScreenshot()` + `snapshot()` + `captureContext()` (so the screenshot reflects the moment of click). Renders: screenshot thumbnail with a **drag-to-blur redaction** overlay (store redaction rects, apply to the canvas before upload), a severity `<select>`, a `<textarea>` for the note, and Submit/Cancel.
- On Submit: assemble `BugReportPayload`, POST JSON to `cfg.endpoint`. Show success/fail toast. Disable double-submit.
- Redaction: let the user draw rectangles on the thumbnail; before submit, fill those rects with opaque black on the canvas, then re-export the data URL.

### `packages/widget/src/index.ts`
```ts
import { install } from "./buffer";
import { renderButton } from "./ui";

export interface BugNoteConfig {
  appId: string;
  endpoint: string;                 // e.g. https://api.bugnote.intellme.com/v1/ingest
  appVersion?: string;
  getUserId?: () => string | undefined;
  position?: "bottom-right" | "bottom-left";
}

export function init(config: BugNoteConfig): void {
  install();                        // instrumentation starts NOW, at load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => renderButton(config));
  } else {
    renderButton(config);
  }
}

export { snapshot } from "./buffer";
```

### `packages/widget/src/react.tsx`
```tsx
import { useEffect } from "react";
import { init, type BugNoteConfig } from "./index";
export function BugNoteProvider(props: BugNoteConfig & { children?: React.ReactNode }) {
  const { children, ...cfg } = props;
  useEffect(() => { init(cfg); /* eslint-disable-next-line */ }, []);
  return <>{children}</>;
}
```
Add `react.tsx` to the tsup entry list and a `"./react"` export in `package.json` `exports`.

### Integration (how Brandon wires it in — goes in Document 3)
- React app: `import { BugNoteProvider } from "@bugnote/widget/react"` → wrap app once with `appId` + `endpoint`.
- Plain site: `<script src=".../bugnote.umd.js"></script>` then `BugNote.init({ appId, endpoint })`.

### WO-1 acceptance
- [ ] Instrumentation is active before any button render; a thrown error 2s before clicking the button appears in the submitted `errors[]`.
- [ ] Secrets in console output (e.g. a logged JWT) arrive redacted server-side.
- [ ] Screenshot captures the viewport at click time; redaction rectangles are baked into the uploaded image.
- [ ] Both builds emit: `dist/index.js` (ESM), `dist/bugnote.umd.js` (global `BugNote`), `dist/react.js`, all with `.d.ts`.
- [ ] Widget never throws into the host app (all hooks wrapped); failure to screenshot still sends a valid report.

---

## WO-2 — Ingest API, schema, queue, dedup, storage (`apps/server`)

**Objective:** receive `BugReportPayload`, store it tagged by `appId`, dedup recurring signatures, upload the screenshot to Spaces, and enqueue a triage job. Provide the worker loop skeleton (stages stubbed for WO-3).

### `apps/server/src/config/index.ts`
```ts
import { z } from "zod";
const Env = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(8090),
  DATABASE_URL: z.string().url(),
  INGEST_ALLOWED_ORIGINS: z.string().transform((s) => s.split(",").map((o) => o.trim()).filter(Boolean)),
  INGEST_RATE_LIMIT_PER_MIN: z.coerce.number().default(30),
  SPACES_ENDPOINT: z.string().optional(),
  SPACES_BUCKET: z.string().default("bugnote-screenshots"),
  SPACES_KEY: z.string().optional(),
  SPACES_SECRET: z.string().optional(),
  AGENT_COST_BUDGET_USD: z.coerce.number().default(0.5),
  AGENT_CONFIDENCE_GATE: z.coerce.number().default(0.6),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL_TRIAGE: z.string().optional(),
  OPENROUTER_MODEL_ANALYSIS: z.string().optional(),
  OPENROUTER_MODEL_FIX: z.string().optional(),
});
export const env = Env.parse(process.env);
```

### `apps/server/src/db/client.ts`
```ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../config";
export const pool = new Pool({ connectionString: env.DATABASE_URL });
export const db = drizzle(pool);
```

### `apps/server/src/db/schema.ts`
```ts
import { pgTable, uuid, text, jsonb, timestamp, integer, index } from "drizzle-orm/pg-core";

export const reports = pgTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  appId: text("app_id").notNull(),
  status: text("status").notNull().default("received"),
  severity: text("severity").notNull().default("medium"),
  signature: text("signature").notNull(),
  note: text("note"),
  context: jsonb("context").notNull(),
  consoleLog: jsonb("console_log").notNull(),
  errors: jsonb("errors").notNull(),
  breadcrumbs: jsonb("breadcrumbs").notNull(),
  screenshotUrl: text("screenshot_url"),
  dossier: jsonb("dossier"),
  prUrl: text("pr_url"),
  dupCount: integer("dup_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  byApp: index("reports_app_idx").on(t.appId),
  bySig: index("reports_sig_idx").on(t.appId, t.signature),
}));

export const jobs = pgTable("jobs", {
  id: uuid("id").primaryKey().defaultRandom(),
  reportId: uuid("report_id").notNull(),
  stage: text("stage").notNull(),
  status: text("status").notNull().default("pending"), // pending|active|done|failed
  attempts: integer("attempts").notNull().default(0),
  runAfter: timestamp("run_after", { withTimezone: true }).notNull().defaultNow(),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  claim: index("jobs_claim_idx").on(t.status, t.runAfter),
}));
```

### `apps/server/src/db/migrate.ts`
```ts
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./client";
async function main() {
  await migrate(db, { migrationsFolder: "drizzle" });
  await pool.end();
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
```
And `apps/server/drizzle.config.ts`:
```ts
import type { Config } from "drizzle-kit";
export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
} satisfies Config;
```
Run `npm run db:generate -w apps/server` to create the initial migration, commit the `drizzle/` folder.

### `apps/server/src/dedup.ts`
```ts
import { createHash } from "node:crypto";
import type { BugReportPayload } from "@bugnote/shared";

function normalize(s: string): string {
  return s
    .replace(/0x[0-9a-f]+/gi, "0x")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<uuid>")
    .replace(/\d+/g, "N")
    .trim();
}
function normStack(stack: string): string {
  return stack.split("\n").slice(0, 5)
    .map((l) => l.replace(/:\d+:\d+/g, "").replace(/https?:\/\/[^\s)]+/g, "<url>"))
    .join("|");
}
export function computeSignature(p: BugReportPayload): string {
  const top = p.errors[0];
  const basis = top
    ? `${top.name}:${normalize(top.message)}:${normStack(top.stack ?? "")}`
    : `note:${normalize(p.note ?? "")}:${p.context.route ?? p.context.url}`;
  return createHash("sha256").update(`${p.appId}|${basis}`).digest("hex").slice(0, 32);
}
```

### `apps/server/src/storage.ts` (spec + signature)
```ts
export async function uploadScreenshot(reportId: string, dataUrl: string): Promise<string | null>;
```
- Use `@aws-sdk/client-s3` configured for DO Spaces (`endpoint: SPACES_ENDPOINT`, `forcePathStyle: false`, region `us-east-1`).
- Decode the base64 PNG, `PutObject` to `SPACES_BUCKET` key `screenshots/{appId}/{reportId}.png`, ACL private. Return the object URL (or a key to sign later).
- If Spaces env is unset, return `null` (dev mode — report still stored without screenshot).

### `apps/server/src/queue/index.ts`
```ts
import { sql } from "drizzle-orm";
import { db } from "../db/client";
import type { PipelineStage } from "@bugnote/shared";

export async function enqueue(reportId: string, stage: PipelineStage, delaySec = 0) {
  await db.execute(sql`
    INSERT INTO jobs (report_id, stage, run_after)
    VALUES (${reportId}, ${stage}, now() + (${delaySec} || ' seconds')::interval)
  `);
}

export async function claimNext(): Promise<any | null> {
  // Atomic claim with SKIP LOCKED — safe for concurrent loops, no broker needed.
  const res = await db.execute(sql`
    UPDATE jobs SET status='active', locked_at=now(), attempts=attempts+1
    WHERE id = (
      SELECT id FROM jobs
      WHERE status='pending' AND run_after <= now()
      ORDER BY run_after
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING *;
  `);
  return (res as any).rows?.[0] ?? null;
}

export async function complete(jobId: string) {
  await db.execute(sql`UPDATE jobs SET status='done' WHERE id=${jobId}`);
}

export async function fail(jobId: string, attempts: number, err: string) {
  const MAX = 3;
  if (attempts >= MAX) {
    await db.execute(sql`UPDATE jobs SET status='failed', last_error=${err} WHERE id=${jobId}`);
  } else {
    const backoff = Math.min(300, 15 * 2 ** attempts);
    await db.execute(sql`
      UPDATE jobs SET status='pending', last_error=${err},
        run_after = now() + (${backoff} || ' seconds')::interval
      WHERE id=${jobId}`);
  }
}
```

### `apps/server/src/api/ingest.ts` (spec + core)
Fastify route `POST /v1/ingest`:
1. Validate `Origin` against `env.INGEST_ALLOWED_ORIGINS`; reject otherwise (403).
2. Parse body with `BugReportPayload.safeParse`; 400 on failure.
3. `const signature = computeSignature(payload)`.
4. **Dedup:** look for an open report with same `appId`+`signature` created in the last 14 days (`status NOT IN ('duplicate','failed')`). If found → `dupCount += 1`, `updatedAt = now()`, return `{ id, deduped: true }`, **do not enqueue**.
5. Insert the report (`status: "received"`). Upload screenshot (if present) → set `screenshotUrl`. Set `status: "queued"`.
6. `await enqueue(report.id, "triage")`. Return `{ id, deduped: false }`.

### `apps/server/src/api/health.ts`
`GET /health` → `{ ok: true, db: <SELECT 1 result> }`; returns 503 if the DB check throws.

### `apps/server/src/index.ts` (API entry)
```ts
import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { env } from "./config";
import { registerIngest } from "./api/ingest";
import { registerHealth } from "./api/health";

const app = Fastify({ logger: true, bodyLimit: 8 * 1024 * 1024 }); // 8MB for inline screenshots
await app.register(cors, { origin: env.INGEST_ALLOWED_ORIGINS, methods: ["POST"] });
await app.register(rateLimit, { max: env.INGEST_RATE_LIMIT_PER_MIN, timeWindow: "1 minute" });
registerHealth(app);
registerIngest(app);
await app.listen({ port: env.PORT, host: "0.0.0.0" });
```

### `apps/server/src/worker.ts` (loop skeleton — stages stubbed for WO-3)
```ts
import { claimNext, complete, fail } from "./queue";
import { runStage } from "./agents";   // implemented in WO-3
import pino from "pino";
const log = pino({ name: "bugnote-worker" });

async function loop() {
  for (;;) {
    const job = await claimNext();
    if (!job) { await new Promise((r) => setTimeout(r, 2000)); continue; }
    try {
      await runStage(job.stage, job.report_id);  // dispatches to the 5-stage pipeline
      await complete(job.id);
    } catch (e: any) {
      log.error({ jobId: job.id, stage: job.stage, err: e?.message }, "stage failed");
      await fail(job.id, job.attempts, e?.message ?? "unknown");
    }
  }
}
loop().catch((e) => { log.error(e); process.exit(1); });
```
Create `apps/server/src/agents/index.ts` with a stub so the build passes:
```ts
import type { PipelineStage } from "@bugnote/shared";
export async function runStage(_stage: PipelineStage, _reportId: string): Promise<void> {
  throw new Error("pipeline not implemented — see WO-3");
}
```

### WO-2 acceptance
- [ ] `npm run db:generate` then `db:migrate` create `reports` + `jobs` in the `bugnote` db (and nowhere else).
- [ ] POSTing a valid payload from an allowlisted origin stores a row tagged by `appId`, uploads the screenshot, and inserts a `triage` job.
- [ ] A second identical-signature report within 14 days increments `dup_count` and does not enqueue.
- [ ] Disallowed origin → 403; malformed body → 400; both without creating rows.
- [ ] `claimNext()` under two concurrent callers never hands the same job to both (SKIP LOCKED verified).
- [ ] `/health` returns 200 with a live DB; 503 when the pool is down.
- [ ] Worker boots, polls, and fails gracefully with the WO-3 stub (logged, backed off, not crashed).

---

## Next

Part 2 implements **WO-3** (five-stage agent pipeline + OpenRouter client with cost budget and confidence gate), **WO-4** (GitHub App: contents-API retrieval + draft PR), and **WO-5** (review dashboard). The `runStage` stub above is the seam WO-3 fills.
