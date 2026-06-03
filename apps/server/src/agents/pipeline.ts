import type { PipelineStage } from "@bugnote/shared";
import { BudgetExceeded } from "./guards.js";
import { loadDossier, saveDossier } from "./dossier.js";
import { triage } from "./stages/triage.js";
import { analysis } from "./stages/analysis.js";
import { investigate } from "./stages/investigate.js";
import { fix } from "./stages/fix.js";
import { pr } from "./stages/pr.js";

const STAGES: Record<PipelineStage, (id: string) => Promise<void>> = {
  triage,
  analysis,
  investigate,
  fix,
  pr,
};

export async function runStage(
  stage: PipelineStage,
  reportId: string,
): Promise<void> {
  try {
    const run = STAGES[stage];
    if (!run) throw new Error(`unknown stage: ${stage}`);
    await run(reportId);
  } catch (e) {
    if (e instanceof BudgetExceeded) {
      const { dossier } = await loadDossier(reportId);
      dossier.haltedReason = e.message;
      await saveDossier(reportId, dossier, "failed");
      return;
    }
    throw e;
  }
}
