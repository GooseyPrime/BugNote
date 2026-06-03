import { env } from "../config/index.js";
import type { Dossier } from "@bugnote/shared";

export class BudgetExceeded extends Error {}

export function chargeAndCheck(d: Dossier, costUsd: number): void {
  d.costUsd = (d.costUsd ?? 0) + costUsd;
  if (d.costUsd > env.AGENT_COST_BUDGET_USD) {
    throw new BudgetExceeded(
      `cost ${d.costUsd.toFixed(3)} > budget ${env.AGENT_COST_BUDGET_USD}`,
    );
  }
}

export function passesGate(confidence: number): boolean {
  return confidence >= env.AGENT_CONFIDENCE_GATE;
}
