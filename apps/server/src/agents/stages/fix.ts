import { FixProposal } from "@bugnote/shared";
import { env } from "../../config/index.js";
import { chat, parseJson } from "../openrouter.js";
import { chargeAndCheck, passesGate } from "../guards.js";
import { loadDossier, saveDossier } from "../dossier.js";
import { enqueue } from "../../queue/index.js";

export async function fix(reportId: string) {
  const { dossier } = await loadDossier(reportId);
  const files = dossier.retrievedFiles ?? [];
  const allowed = new Set(files.map((f) => f.path));

  const sys =
    "You are a fix agent. Reply ONLY with JSON: " +
    '{"summary":"string","diff":"unified diff string","files":[{"path":"must be from retrieved","newContent":"full file"}],"confidence":0.0-1.0}';
  const user = JSON.stringify({
    hypothesis: dossier.analysis?.hypothesis,
    files: files.map((f) => ({ path: f.path, content: f.content.slice(0, 8000) })),
  });

  const r = await chat(
    env.OPENROUTER_MODEL_FIX ?? "anthropic/claude-sonnet-4",
    [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
    { json: true, maxTokens: 4000 },
  );
  chargeAndCheck(dossier, r.costUsd);

  const proposal = FixProposal.parse(parseJson(r.text));
  for (const f of proposal.files) {
    if (!allowed.has(f.path)) {
      dossier.haltedReason = "hallucinated file path";
      await saveDossier(reportId, dossier, "fix_proposed");
      return;
    }
  }

  dossier.fix = proposal;
  dossier.notes.push(`fix: ${proposal.summary}`);

  if (!passesGate(proposal.confidence)) {
    dossier.haltedReason = "below confidence gate";
    await saveDossier(reportId, dossier, "fix_proposed");
    return;
  }

  await saveDossier(reportId, dossier, "fix_proposed");
  await enqueue(reportId, "pr");
}
