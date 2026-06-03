import { env } from "../config/index.js";

export type Content = string | Array<Record<string, unknown>>;
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: Content;
}
export interface LlmResult {
  text: string;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
}

/** USD per 1M tokens — fallback when OpenRouter does not return usage cost. */
const PRICE: Record<string, { in: number; out: number }> = {
  default: { in: 1.0, out: 3.0 },
  "openai/gpt-4o-mini": { in: 0.15, out: 0.6 },
  "openai/gpt-4o": { in: 2.5, out: 10 },
  "anthropic/claude-sonnet-4": { in: 3, out: 15 },
};

function estimateCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const p = PRICE[model] ?? PRICE["default"]!;
  return (promptTokens / 1e6) * p.in + (completionTokens / 1e6) * p.out;
}

function costFromUsage(
  usage: Record<string, unknown> | undefined,
  model: string,
  promptTokens: number,
  completionTokens: number,
): number | undefined {
  if (!usage) return undefined;
  const total =
    typeof usage.total_cost === "number"
      ? usage.total_cost
      : typeof usage.cost === "number"
        ? usage.cost
        : undefined;
  if (total !== undefined && Number.isFinite(total)) return total;
  return undefined;
}

export async function chat(
  model: string,
  messages: ChatMessage[],
  opts?: { json?: boolean; maxTokens?: number },
): Promise<LlmResult> {
  if (!env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY not set");
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "X-Title": "BugNote",
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: opts?.maxTokens ?? 1500,
      ...(opts?.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  const headerCostRaw = res.headers.get("x-openrouter-cost");
  const headerCost = headerCostRaw ? Number(headerCostRaw) : NaN;
  const data = (await res.json()) as Record<string, unknown>;
  const choices = data.choices as Array<{ message?: { content?: string } }> | undefined;
  const usage = data.usage as Record<string, unknown> | undefined;
  const text = choices?.[0]?.message?.content ?? "";
  const pt = (usage?.prompt_tokens as number | undefined) ?? 0;
  const ct = (usage?.completion_tokens as number | undefined) ?? 0;
  const fromUsage = costFromUsage(usage, model, pt, ct);
  const costUsd =
    Number.isFinite(headerCost) && headerCost >= 0
      ? headerCost
      : fromUsage ?? estimateCostUsd(model, pt, ct);
  return {
    text,
    promptTokens: pt,
    completionTokens: ct,
    costUsd,
  };
}

export function parseJson<T>(text: string): T {
  return JSON.parse(text.replace(/```json|```/g, "").trim()) as T;
}
