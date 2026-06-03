import { retrieveFiles, searchCode } from "@bugnote/github-app";
import { loadDossier, saveDossier } from "../dossier.js";
import { enqueue } from "../../queue/index.js";

const MAX_SEARCH = 10;

export async function investigate(reportId: string) {
  const { dossier } = await loadDossier(reportId);
  const repo = dossier.repo;
  const analysis = dossier.analysis;

  if (!repo || !analysis) {
    dossier.haltedReason = "no repo mapped";
    await saveDossier(reportId, dossier, "analyzed");
    return;
  }

  let paths = analysis.suspectFiles ?? [];
  if (paths.length === 0) {
    paths = await searchCode(repo, analysis.hypothesis.slice(0, 120));
  }

  const retrieved = await retrieveFiles(repo, paths);
  dossier.retrievedFiles = retrieved;

  if (!retrieved.length) {
    dossier.haltedReason = "no files retrieved";
    await saveDossier(reportId, dossier, "analyzed");
    return;
  }

  dossier.notes.push(`investigate: ${retrieved.length} files`);
  await saveDossier(reportId, dossier, "investigating");
  await enqueue(reportId, "fix");
}
