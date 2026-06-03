import { sql } from "drizzle-orm";
import { Dossier, type ReportStatus } from "@bugnote/shared";
import { env } from "../config/index.js";
import { db } from "../db/client.js";
import { getFirstRow } from "../db/rows.js";

export type ReportRow = {
  id: string;
  app_id: string;
  status: string;
  note: string | null;
  context: Record<string, unknown>;
  console_log: unknown[];
  errors: unknown[];
  breadcrumbs: unknown[];
  screenshot_url: string | null;
  dossier: unknown;
  pr_url: string | null;
};

export async function loadDossier(
  reportId: string,
): Promise<{ report: ReportRow; dossier: Dossier }> {
  const r = await db.execute(sql`SELECT * FROM reports WHERE id = ${reportId}`);
  const report = getFirstRow<ReportRow>(r);
  if (!report) throw new Error(`report ${reportId} not found`);

  let dossier: Dossier;
  if (report.dossier) {
    dossier = Dossier.parse(report.dossier);
  } else {
    dossier = Dossier.parse({
      reportId,
      appId: report.app_id,
      repo: env.GITHUB_APP_REPO_MAP[report.app_id],
      costUsd: 0,
      notes: [],
    });
  }
  return { report, dossier };
}

export async function saveDossier(
  reportId: string,
  dossier: Dossier,
  status?: ReportStatus,
): Promise<void> {
  const prUrl = dossier.prUrl ?? null;
  await db.execute(sql`
    UPDATE reports
    SET dossier = ${JSON.stringify(dossier)}::jsonb,
        status = COALESCE(${status ?? null}, status),
        pr_url = COALESCE(${prUrl}, pr_url),
        updated_at = now()
    WHERE id = ${reportId}
  `);
}
