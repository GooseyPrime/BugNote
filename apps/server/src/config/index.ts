import { z } from "zod";

const Env = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(8090),
  DATABASE_URL: z.string().url(),
  INGEST_ALLOWED_ORIGINS: z
    .string()
    .transform((s) => s.split(",").map((o) => o.trim()).filter(Boolean)),
  ADMIN_ALLOWED_ORIGINS: z
    .string()
    .default("")
    .transform((s) => s.split(",").map((o) => o.trim()).filter(Boolean)),
  INGEST_RATE_LIMIT_PER_MIN: z.coerce.number().default(30),
  SPACES_ENDPOINT: z.string().optional(),
  SPACES_BUCKET: z.string().default("bugnote-screenshots"),
  SPACES_KEY: z.string().optional(),
  SPACES_SECRET: z.string().optional(),
  AGENT_COST_BUDGET_USD: z.coerce.number().default(0.5),
  AGENT_CONFIDENCE_GATE: z.coerce.number().default(0.6),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL_TRIAGE: z.string().optional(),
  OPENROUTER_MODEL_ANALYSIS: z.string().optional(),
  OPENROUTER_MODEL_FIX: z.string().optional(),
  GITHUB_APP_ID: z.string().optional(),
  GITHUB_APP_PRIVATE_KEY: z.string().optional(),
  GITHUB_APP_REPO_MAP: z
    .string()
    .default("{}")
    .transform((s) => {
      try {
        return JSON.parse(s) as Record<string, string>;
      } catch {
        return {};
      }
    }),
  CLERK_SECRET_KEY: z.string().optional(),
  CLERK_PUBLISHABLE_KEY: z.string().optional(),
});

export const env = Env.parse(process.env);
