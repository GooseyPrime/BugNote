import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { requireDatabaseUrl } from "./test-env.js";
import { db, pool } from "./db/client.js";
import { getFirstRow } from "./db/rows.js";
import { claimNext, complete, enqueue } from "./queue/index.js";

beforeAll(() => {
  requireDatabaseUrl();
});

afterAll(async () => {
  await pool.end();
});

describe("claimNext SKIP LOCKED", () => {
  it("never assigns the same job to two concurrent claimers", async () => {
    const reportRes = await db.execute(sql`
      INSERT INTO reports (
        app_id, status, severity, signature, context, console_log, errors, breadcrumbs
      ) VALUES (
        'conctest', 'queued', 'low', 'sig-conc',
        '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb
      ) RETURNING id
    `);
    const inserted = getFirstRow<{ id: string }>(reportRes);
    if (!inserted) throw new Error("insert failed");
    const reportId = inserted.id;
    await enqueue(reportId, "triage");

    const [a, b] = await Promise.all([claimNext(), claimNext()]);
    const ids = [a?.id, b?.id].filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);

    if (a) await complete(a.id);
    if (b) await complete(b.id);
  });
});
