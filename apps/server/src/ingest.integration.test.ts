import { afterAll, beforeAll, describe, expect, it } from "vitest";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { sql } from "drizzle-orm";
import { requireDatabaseUrl } from "./test-env.js";
import { env } from "./config/index.js";
import { db, pool } from "./db/client.js";
import { getFirstRow } from "./db/rows.js";
import { registerIngest } from "./api/ingest.js";

const ALLOWED = env.INGEST_ALLOWED_ORIGINS[0] ?? "https://test.example";

let app: ReturnType<typeof Fastify>;

beforeAll(async () => {
  requireDatabaseUrl();
  app = Fastify();
  await app.register(cors, { origin: true });
  registerIngest(app);
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await pool.end();
});

const validBody = {
  appId: "ingesttest",
  severity: "medium",
  context: {
    url: "https://test.example/page",
    userAgent: "vitest",
    viewport: { w: 800, h: 600 },
    sessionId: "sess-1",
  },
  console: [],
  errors: [{ ts: 1, kind: "error", name: "E", message: "boom", stack: "E: boom" }],
  breadcrumbs: [],
};

describe("POST /v1/ingest", () => {
  it("returns 403 for disallowed origin", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/ingest",
      headers: { origin: "https://evil.example", "content-type": "application/json" },
      payload: validBody,
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 400 for malformed body", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/ingest",
      headers: { origin: ALLOWED, "content-type": "application/json" },
      payload: { appId: "" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("stores a report and enqueues triage for allowed origin", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/ingest",
      headers: { origin: ALLOWED, "content-type": "application/json" },
      payload: validBody,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { id: string; deduped: boolean };
    expect(body.deduped).toBe(false);

    const jobs = await db.execute(
      sql`SELECT stage FROM jobs WHERE report_id = ${body.id} AND stage = 'triage'`,
    );
    expect((jobs as { rows: unknown[] }).rows.length).toBeGreaterThan(0);
  });

  it("dedupes identical signature within 14 days", async () => {
    const first = await app.inject({
      method: "POST",
      url: "/v1/ingest",
      headers: { origin: ALLOWED, "content-type": "application/json" },
      payload: validBody,
    });
    const id1 = (first.json() as { id: string }).id;

    const second = await app.inject({
      method: "POST",
      url: "/v1/ingest",
      headers: { origin: ALLOWED, "content-type": "application/json" },
      payload: validBody,
    });
    const body2 = second.json() as { id: string; deduped: boolean };
    expect(body2.deduped).toBe(true);
    expect(body2.id).toBe(id1);

    const dup = await db.execute(
      sql`SELECT dup_count FROM reports WHERE id = ${id1}`,
    );
    const dupRow = getFirstRow<{ dup_count: number }>(dup);
    expect(dupRow?.dup_count).toBeGreaterThanOrEqual(1);
  });
});
