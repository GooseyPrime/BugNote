import type { FastifyInstance, FastifyRequest } from "fastify";
import { sql } from "drizzle-orm";
import { BugReportPayload } from "@bugnote/shared";
import { env } from "../config/index.js";
import { db } from "../db/client.js";
import { computeSignature } from "../dedup.js";
import { enqueue } from "../queue/index.js";
import { uploadScreenshot } from "../storage.js";
import { getFirstRow } from "../db/rows.js";

function originAllowed(req: FastifyRequest): boolean {
  const origin = req.headers.origin;
  if (!origin) return env.INGEST_ALLOWED_ORIGINS.length === 0;
  return env.INGEST_ALLOWED_ORIGINS.includes(origin);
}

export function registerIngest(app: FastifyInstance) {
  app.post("/v1/ingest", async (req, reply) => {
    if (!originAllowed(req)) {
      return reply.code(403).send({ error: "origin not allowed" });
    }

    const parsed = BugReportPayload.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "invalid payload" });
    }
    const payload = parsed.data;
    const signature = computeSignature(payload);

    const dupRes = await db.execute(sql`
      SELECT id, dup_count FROM reports
      WHERE app_id = ${payload.appId}
        AND signature = ${signature}
        AND status NOT IN ('duplicate', 'failed')
        AND created_at > now() - interval '14 days'
      ORDER BY created_at DESC
      LIMIT 1
    `);
    const dupRow = getFirstRow<{ id: string; dup_count: number }>(dupRes);
    if (dupRow) {
      await db.execute(sql`
        UPDATE reports SET dup_count = dup_count + 1, updated_at = now()
        WHERE id = ${dupRow.id}
      `);
      return { id: dupRow.id, deduped: true };
    }

    const insertRes = await db.execute(sql`
      INSERT INTO reports (
        app_id, status, severity, signature, note, context,
        console_log, errors, breadcrumbs
      ) VALUES (
        ${payload.appId}, 'received', ${payload.severity}, ${signature},
        ${payload.note ?? null}, ${JSON.stringify(payload.context)}::jsonb,
        ${JSON.stringify(payload.console)}::jsonb,
        ${JSON.stringify(payload.errors)}::jsonb,
        ${JSON.stringify(payload.breadcrumbs)}::jsonb
      )
      RETURNING id
    `);
    const inserted = getFirstRow<{ id: string }>(insertRes);
    if (!inserted) throw new Error("insert failed");
    const reportId = inserted.id;

    let screenshotKey: string | null = null;
    if (payload.screenshotBase64) {
      screenshotKey = await uploadScreenshot(
        payload.appId,
        reportId,
        payload.screenshotBase64,
      );
    }

    // Job row before status promises a queued pipeline (repo rule: side effect before promised state).
    await enqueue(reportId, "triage");
    await db.execute(sql`
      UPDATE reports
      SET status = 'queued',
          screenshot_url = ${screenshotKey},
          updated_at = now()
      WHERE id = ${reportId}
    `);
    return { id: reportId, deduped: false };
  });
}
