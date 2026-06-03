# BugNote — Document 2 of 3 (Part 3: WO-5)

Final Cursor work order. Same rules. WO-5 has two halves: the **admin read API** added to `apps/server`, and the **dashboard frontend** in `apps/dashboard` (deploys to Vercel, not Emma).

---

## WO-5 — Review dashboard

**Objective:** a single-admin console to browse reports per app, inspect the full capture + agent dossier + proposed diff, jump to the draft PR, and take manual actions (mark resolved/duplicate, re-run a stage).

### Part A — Admin API (`apps/server`)

Add deps to `apps/server/package.json`: `google-auth-library@^9.14.0`, `@aws-sdk/s3-request-presigner@^3.600.0`.

Admin auth is Google OAuth ID-token verification against an email allowlist (single-admin). The server verifies the Google ID token with `google-auth-library` and checks `ADMIN_ALLOWED_EMAILS`; the dashboard uses `@react-oauth/google`, sends the ID token as the Bearer, and re-prompts on 401/403.

#### `apps/server/src/api/auth.ts`
```ts
import type { FastifyReply, FastifyRequest } from "fastify";
import { OAuth2Client } from "google-auth-library";
import { env } from "../config";

const client = new OAuth2Client();
const ALLOWED = env.ADMIN_ALLOWED_EMAILS.split(",").map((s) => s.trim().toLowerCase());

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const token = (req.headers.authorization ?? "").replace(/^Bearer /, "");
  if (!token) return reply.code(401).send({ error: "unauthorized" });
  try {
    const ticket = await client.verifyIdToken({ idToken: token, audience: env.GOOGLE_OAUTH_CLIENT_ID });
    const p = ticket.getPayload();
    if (!p?.email_verified || !ALLOWED.includes((p.email ?? "").toLowerCase())) {
      return reply.code(403).send({ error: "forbidden" });
    }
    (req as any).userEmail = p.email;
  } catch {
    return reply.code(401).send({ error: "unauthorized" });
  }
}
```
Add `GOOGLE_OAUTH_CLIENT_ID: z.string()` and `ADMIN_ALLOWED_EMAILS: z.string()` to the config schema (see `.env.example`).

#### `apps/server/src/storage.ts` — add a presigner
```ts
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
// reuse the S3 client constructed for uploads
export async function signedScreenshotUrl(key: string): Promise<string> {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: env.SPACES_BUCKET, Key: key }), { expiresIn: 300 });
}
```
Store the **object key** (not a public URL) in `reports.screenshot_url` so detail responses can sign on demand.

#### `apps/server/src/api/admin.ts` (core handlers)
All routes `preHandler: requireAuth`. Mount under `/v1/admin`.
```ts
import type { FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";
import { db } from "../db/client";
import { requireAuth } from "./auth";
import { signedScreenshotUrl } from "../storage";
import { enqueue } from "../queue";

export function registerAdmin(app: FastifyInstance) {
  // App list with status counts
  app.get("/v1/admin/apps", { preHandler: requireAuth }, async () => {
    const r = await db.execute(sql`
      SELECT app_id, status, count(*)::int AS n
      FROM reports GROUP BY app_id, status ORDER BY app_id`);
    return (r as any).rows;
  });

  // Report list (summary), filterable
  app.get("/v1/admin/reports", { preHandler: requireAuth }, async (req) => {
    const { appId, status, limit = "50" } = req.query as Record<string, string>;
    const r = await db.execute(sql`
      SELECT id, app_id, status, severity, dup_count, pr_url, created_at, updated_at,
             left(coalesce(note,''), 140) AS note_preview
      FROM reports
      WHERE (${appId ?? null}::text IS NULL OR app_id = ${appId ?? null})
        AND (${status ?? null}::text IS NULL OR status = ${status ?? null})
      ORDER BY updated_at DESC
      LIMIT ${Number(limit)}`);
    return (r as any).rows;
  });

  // Full detail + signed screenshot
  app.get("/v1/admin/reports/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const r = await db.execute(sql`SELECT * FROM reports WHERE id = ${id}`);
    const row = (r as any).rows[0];
    if (!row) return reply.code(404).send({ error: "not found" });
    const screenshot = row.screenshot_url ? await signedScreenshotUrl(row.screenshot_url) : null;
    return { ...row, screenshot };
  });

  // Manual status change
  app.post("/v1/admin/reports/:id/status", { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const { status } = req.body as { status: string };
    await db.execute(sql`UPDATE reports SET status=${status}, updated_at=now() WHERE id=${id}`);
    return { ok: true };
  });

  // Re-run from a stage (manual kick)
  app.post("/v1/admin/reports/:id/retry", { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const { stage = "triage" } = req.body as { stage?: string };
    await enqueue(id, stage as any);
    return { ok: true };
  });
}
```
Register it in `apps/server/src/index.ts` after the ingest routes, and widen CORS to also allow the dashboard origin for `GET/POST` on `/v1/admin/*` (add the Vercel dashboard URL to an `ADMIN_ALLOWED_ORIGINS` env, or reuse a dedicated CORS scope for the admin prefix).

#### Part A acceptance
- [ ] Every `/v1/admin/*` route returns 401 without a token; 403 for a valid Google token whose email is not allowlisted.
- [ ] `/v1/admin/apps` returns per-app status counts; `/v1/admin/reports` filters by `appId` and `status`.
- [ ] Detail returns the full dossier and a screenshot URL that expires (~5 min).
- [ ] `status` and `retry` actions mutate the row / enqueue a job and are auth-gated.

### Part B — Dashboard frontend (`apps/dashboard`)

Vite + React + Tailwind + `@react-oauth/google`. Deploys to Vercel. Env (Vercel project settings): `VITE_GOOGLE_OAUTH_CLIENT_ID`, `VITE_API_BASE` (the Emma ingest server's public URL).

#### `apps/dashboard/src/main.tsx`
Wrap the app in `GoogleOAuthProvider` (`clientId={import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID}`). Use a small React context to store the Google `credential` (ID token). When no credential is stored, render `<GoogleLogin>`; when signed in, render `BrowserRouter` + `App`.

#### `apps/dashboard/src/api.ts`
Read the stored Google credential from context and send `Authorization: Bearer <credential>`. On `401` or `403`, clear the credential so the sign-in gate re-renders (handles ~1-hour ID token expiry).

```ts
const BASE = import.meta.env.VITE_API_BASE as string;

export function useApi() {
  // credential from auth context
  async function req<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${credential}`, ...(init?.headers ?? {}) },
    });
    if (res.status === 401 || res.status === 403) { clearCredential(); throw ...; }
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return res.json() as Promise<T>;
  }
  return {
    apps: () => req<Array<{ app_id: string; status: string; n: number }>>("/v1/admin/apps"),
    reports: (appId?: string, status?: string) =>
      req<any[]>(`/v1/admin/reports?${new URLSearchParams({ ...(appId && { appId }), ...(status && { status }) })}`),
    report: (id: string) => req<any>(`/v1/admin/reports/${id}`),
    setStatus: (id: string, status: string) =>
      req(`/v1/admin/reports/${id}/status`, { method: "POST", body: JSON.stringify({ status }) }),
    retry: (id: string, stage = "triage") =>
      req(`/v1/admin/reports/${id}/retry`, { method: "POST", body: JSON.stringify({ stage }) }),
  };
}
```

#### `apps/dashboard/src/App.tsx` (routing + layout)
```tsx
import { Routes, Route } from "react-router-dom";
import Inbox from "./pages/Inbox";
import ReportDetail from "./pages/ReportDetail";
import AppSidebar from "./components/AppSidebar";
export default function App() {
  return (
    <div className="flex h-screen bg-neutral-50 text-neutral-900">
      <AppSidebar />
      <div className="flex-1 flex flex-col">
        <header className="h-14 border-b flex items-center justify-between px-4">
          <span className="font-medium">BugNote</span>
          <button type="button" onClick={() => clearCredential()}>Sign out</button>
        </header>
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<Inbox />} />
            <Route path="/app/:appId" element={<Inbox />} />
            <Route path="/report/:id" element={<ReportDetail />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
```

#### Components — implement to spec (Tailwind, no extra UI libs)
- `components/AppSidebar.tsx`: calls `api.apps()`, rolls counts per `app_id`, lists apps as links to `/app/:appId` with a total badge and a small red badge for `failed`/`needs_info` counts.
- `pages/Inbox.tsx`: reads `:appId` param, status filter pills (all / queued / analyzing / fix_proposed / pr_opened / needs_info / failed), table of `api.reports(appId, status)` rows → `note_preview`, severity chip, status chip, dup count, relative time; row click → `/report/:id`.
- `pages/ReportDetail.tsx`: the important one — render in this order:
  1. Header: app, severity, status chip, created/updated, dup count; action buttons (`Mark resolved`, `Mark duplicate`, `Re-run triage`) wired to `api.setStatus`/`api.retry`.
  2. Screenshot (the signed `screenshot` URL) in a bordered frame.
  3. Context block: url/route, viewport, userAgent, userId, sessionId.
  4. **Dossier timeline**: triage → analysis → investigate → fix, each as a card showing its fields; show `costUsd` and `haltedReason` prominently if present.
  5. Console + breadcrumb trail: a monospace, scrollable, timestamp-ordered merge of `console`, `errors` (highlighted red), and `breadcrumbs`.
  6. Proposed fix: `fix.summary`, `fix.confidence`, the `fix.diff` in a `<pre>` with simple +/- line coloring, and a prominent link to `pr_url` (“Open draft PR”) when set.

Keep all colors via Tailwind utilities; ensure readable contrast. No localStorage/sessionStorage.

#### `apps/dashboard` config files (create)
- `index.html` with `<div id="root">` and the Vite entry.
- `vite.config.ts` with `@vitejs/plugin-react`.
- `tailwind.config.js` (content globs over `./index.html` and `./src/**/*.{ts,tsx}`), `postcss.config.js`, `src/index.css` with the three `@tailwind` directives.
- `vercel.json`: SPA rewrite all routes to `/index.html`.

#### Part B acceptance
- [ ] Unauthenticated visitors see the Google sign-in gate; signed-in users see the app sidebar; expired tokens re-prompt after 401/403.
- [ ] Selecting an app lists its reports; status pills filter the list.
- [ ] Report detail shows screenshot, context, full dossier timeline (with cost and any halt reason), the merged console/breadcrumb trail, the proposed diff, and a working draft-PR link.
- [ ] `Mark resolved`, `Mark duplicate`, and `Re-run triage` update the backend and reflect on refetch.
- [ ] `npm run build -w apps/dashboard` produces a deployable Vite build.

---

## Document 2 complete

The repo, when WO-1 through WO-5 are green, is a working BugNote: a widget that captures before the click, an isolated ingest + queue on Emma, a budgeted, gated five-stage pipeline that opens draft PRs, and a console to review them. **Document 3** (next) is the operations guide for standing it up on Emma and onboarding your apps.
