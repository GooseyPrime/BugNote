import type { FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";
import type { PipelineStage } from "@bugnote/shared";
import { db } from "../db/client.js";
import { requireAuth } from "./auth.js";
import { signedScreenshotUrl } from "../storage.js";
import { enqueue } from "../queue/index.js";
import { getRows, getFirstRow } from "../db/rows.js";

export function registerAdmin(app: FastifyInstance) {
  app.get("/v1/admin/apps", { preHandler: requireAuth }, async () => {
    const r = await db.execute(sql`
      SELECT app_id, status, count(*)::int AS n
      FROM reports GROUP BY app_id, status ORDER BY app_id`);
    return getRows(r);
  });

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
    return getRows(r);
  });

  app.get("/v1/admin/reports/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const r = await db.execute(sql`SELECT * FROM reports WHERE id = ${id}`);
    const row = getFirstRow<Record<string, unknown>>(r);
    if (!row) return reply.code(404).send({ error: "not found" });
    let screenshot: string | null = null;
    if (row.screenshot_url) {
      try {
        screenshot = await signedScreenshotUrl(String(row.screenshot_url));
      } catch {
        screenshot = null;
      }
    }
    return { ...row, screenshot };
  });

  app.post(
    "/v1/admin/reports/:id/status",
    { preHandler: requireAuth },
    async (req) => {
      const { id } = req.params as { id: string };
      const { status } = req.body as { status: string };
      await db.execute(
        sql`UPDATE reports SET status=${status}, updated_at=now() WHERE id=${id}`,
      );
      return { ok: true };
    },
  );

  app.post(
    "/v1/admin/reports/:id/retry",
    { preHandler: requireAuth },
    async (req) => {
      const { id } = req.params as { id: string };
      const { stage = "triage" } = req.body as { stage?: string };
      await enqueue(id, stage as PipelineStage);
      return { ok: true };
    },
  );
}
