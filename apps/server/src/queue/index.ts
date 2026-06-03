import { sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { getFirstRow } from "../db/rows.js";
import type { PipelineStage } from "@bugnote/shared";

export type ClaimedJob = {
  id: string;
  report_id: string;
  stage: PipelineStage;
  status: string;
  attempts: number;
  run_after: Date;
  locked_at: Date | null;
  last_error: string | null;
  created_at: Date;
};

export async function enqueue(
  reportId: string,
  stage: PipelineStage,
  delaySec = 0,
): Promise<void> {
  await db.execute(sql`
    INSERT INTO jobs (report_id, stage, run_after)
    VALUES (${reportId}, ${stage}, now() + (${delaySec} || ' seconds')::interval)
  `);
}

export async function claimNext(): Promise<ClaimedJob | null> {
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
  const row = getFirstRow<ClaimedJob>(res);
  return row ?? null;
}

export async function complete(jobId: string): Promise<void> {
  await db.execute(sql`UPDATE jobs SET status='done' WHERE id=${jobId}`);
}

export async function fail(
  jobId: string,
  attempts: number,
  err: string,
): Promise<void> {
  const MAX = 3;
  if (attempts >= MAX) {
    await db.execute(
      sql`UPDATE jobs SET status='failed', last_error=${err} WHERE id=${jobId}`,
    );
  } else {
    const backoff = Math.min(300, 15 * 2 ** attempts);
    await db.execute(sql`
      UPDATE jobs SET status='pending', last_error=${err},
        run_after = now() + (${backoff} || ' seconds')::interval
      WHERE id=${jobId}
    `);
  }
}
