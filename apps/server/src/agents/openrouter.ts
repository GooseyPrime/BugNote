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

const PRICE: Record<string, { in: number; out: number }> = {
  default: { in: 1.0, out: 3.0 },
};

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
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const text = data.choices?.[0]?.message?.content ?? "";
  const pt = data.usage?.prompt_tokens ?? 0;
  const ct = data.usage?.completion_tokens ?? 0;
  const p = PRICE[model] ?? PRICE["default"]!;
  return {
    text,
    promptTokens: pt,
    completionTokens: ct,
    costUsd: (pt / 1e6) * p.in + (ct / 1e6) * p.out,
  };
}

export function parseJson<T>(text: string): T {
  return JSON.parse(text.replace(/```json|```/g, "").trim()) as T;
}
