import { openDraftPr } from "@bugnote/github-app";
import { loadDossier, saveDossier } from "../dossier.js";

export async function pr(reportId: string) {
  const { report, dossier } = await loadDossier(reportId);
  if (!dossier.repo || !dossier.fix) {
    dossier.haltedReason = "missing fix or repo";
    await saveDossier(reportId, dossier, "failed");
    return;
  }

  const prUrl = await openDraftPr(dossier.repo, dossier.fix, { id: report.id });
  dossier.prUrl = prUrl;
  dossier.notes.push(`pr: ${prUrl}`);
  await saveDossier(reportId, dossier, "pr_opened");
}
