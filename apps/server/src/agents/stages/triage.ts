import { TriageResult } from "@bugnote/shared";
import { env } from "../../config/index.js";
import { chat, parseJson } from "../openrouter.js";
import { chargeAndCheck } from "../guards.js";
import { loadDossier, saveDossier } from "../dossier.js";
import { enqueue } from "../../queue/index.js";

export async function triage(reportId: string) {
  const { report, dossier } = await loadDossier(reportId);

  const sys =
    "You are a bug triage agent. Reply ONLY with JSON: " +
    '{"category":"ui|logic|network|data|auth|performance|unknown","severity":"low|medium|high|critical",' +
    '"componentHint":"optional string","actionable":boolean,"reason":"short string"}';
  const user = JSON.stringify({
    note: report.note,
    errors: report.errors,
    breadcrumbs: report.breadcrumbs,
    route:
      (report.context as { route?: string; url?: string })?.route ??
      (report.context as { url?: string })?.url,
  });

  const r = await chat(
    env.OPENROUTER_MODEL_TRIAGE ?? "openai/gpt-4o-mini",
    [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
    { json: true, maxTokens: 400 },
  );
  chargeAndCheck(dossier, r.costUsd);

  const result = TriageResult.parse(parseJson(r.text));
  dossier.triage = result;
  dossier.notes.push(`triage: ${result.category}/${result.severity}`);

  if (!result.actionable) {
    dossier.haltedReason = "not actionable";
    await saveDossier(reportId, dossier, "needs_info");
    return;
  }
  await saveDossier(reportId, dossier, "triaged");
  await enqueue(reportId, "analysis");
}
