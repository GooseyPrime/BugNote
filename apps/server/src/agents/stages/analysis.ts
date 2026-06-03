import { AnalysisResult } from "@bugnote/shared";
import { env } from "../../config/index.js";
import { chat, parseJson } from "../openrouter.js";
import { chargeAndCheck, passesGate } from "../guards.js";
import { loadDossier, saveDossier } from "../dossier.js";
import { enqueue } from "../../queue/index.js";
import { signedScreenshotUrl } from "../../storage.js";

export async function analysis(reportId: string) {
  const { report, dossier } = await loadDossier(reportId);

  if (!dossier.repo) {
    dossier.haltedReason = "no repo mapped";
    await saveDossier(reportId, dossier, "analyzed");
    return;
  }

  const sys =
    "You are a bug analysis agent. Reply ONLY with JSON: " +
    '{"hypothesis":"string","suspectFiles":["path"],"topFrame":{"file":"optional","symbol":"optional"},"confidence":0.0-1.0}';
  const userText = JSON.stringify({
    note: report.note,
    errors: report.errors,
    console: report.console_log,
    breadcrumbs: report.breadcrumbs,
  });

  const content: Array<Record<string, unknown>> = [
    { type: "text", text: userText },
  ];
  if (report.screenshot_url) {
    try {
      const url = await signedScreenshotUrl(String(report.screenshot_url));
      content.push({
        type: "image_url",
        image_url: { url },
      });
    } catch {
      dossier.notes.push("analysis: screenshot unavailable (Spaces not configured)");
    }
  }

  const r = await chat(
    env.OPENROUTER_MODEL_ANALYSIS ?? "openai/gpt-4o",
    [
      { role: "system", content: sys },
      { role: "user", content },
    ],
    { json: true, maxTokens: 800 },
  );
  chargeAndCheck(dossier, r.costUsd);

  const result = AnalysisResult.parse(parseJson(r.text));
  dossier.analysis = result;
  dossier.notes.push(`analysis: ${result.hypothesis.slice(0, 80)}`);

  if (!passesGate(result.confidence)) {
    dossier.haltedReason = "below confidence gate";
    await saveDossier(reportId, dossier, "analyzed");
    return;
  }

  await saveDossier(reportId, dossier, "analyzing");
  await enqueue(reportId, "investigate");
}
