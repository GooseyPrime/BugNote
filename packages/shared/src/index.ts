import { z } from "zod";

export const Severity = z.enum(["low", "medium", "high", "critical"]);
export type Severity = z.infer<typeof Severity>;

export const ConsoleEntry = z.object({
  level: z.enum(["log", "info", "warn", "error", "debug"]),
  ts: z.number(),
  args: z.array(z.string()),
});
export type ConsoleEntry = z.infer<typeof ConsoleEntry>;

export const ErrorEntry = z.object({
  ts: z.number(),
  kind: z.enum(["error", "unhandledrejection"]),
  name: z.string(),
  message: z.string(),
  stack: z.string().optional(),
  source: z.string().optional(),
  line: z.number().optional(),
  col: z.number().optional(),
});
export type ErrorEntry = z.infer<typeof ErrorEntry>;

export const Breadcrumb = z.object({
  ts: z.number(),
  type: z.enum(["click", "navigation", "fetch", "xhr", "custom"]),
  message: z.string(),
  data: z.record(z.string()).optional(),
});
export type Breadcrumb = z.infer<typeof Breadcrumb>;

export const CaptureContext = z.object({
  url: z.string(),
  route: z.string().optional(),
  userAgent: z.string(),
  viewport: z.object({ w: z.number(), h: z.number() }),
  appVersion: z.string().optional(),
  userId: z.string().optional(),
  sessionId: z.string(),
});
export type CaptureContext = z.infer<typeof CaptureContext>;

export const BugReportPayload = z.object({
  appId: z.string().min(1),
  severity: Severity.default("medium"),
  note: z.string().max(5000).optional(),
  context: CaptureContext,
  console: z.array(ConsoleEntry).max(100),
  errors: z.array(ErrorEntry).max(50),
  breadcrumbs: z.array(Breadcrumb).max(50),
  screenshotBase64: z.string().optional(),
});
export type BugReportPayload = z.infer<typeof BugReportPayload>;

export const ReportStatus = z.enum([
  "received",
  "queued",
  "triaged",
  "analyzing",
  "analyzed",
  "investigating",
  "fix_proposed",
  "pr_opened",
  "needs_info",
  "duplicate",
  "failed",
]);
export type ReportStatus = z.infer<typeof ReportStatus>;

export const PipelineStage = z.enum([
  "triage",
  "analysis",
  "investigate",
  "fix",
  "pr",
]);
export type PipelineStage = z.infer<typeof PipelineStage>;

export const Confidence = z.number().min(0).max(1);

export const TriageResult = z.object({
  category: z.enum([
    "ui",
    "logic",
    "network",
    "data",
    "auth",
    "performance",
    "unknown",
  ]),
  severity: Severity,
  componentHint: z.string().optional(),
  actionable: z.boolean(),
  reason: z.string(),
});
export type TriageResult = z.infer<typeof TriageResult>;

export const AnalysisResult = z.object({
  hypothesis: z.string(),
  suspectFiles: z.array(z.string()),
  topFrame: z
    .object({ file: z.string().optional(), symbol: z.string().optional() })
    .optional(),
  confidence: Confidence,
});
export type AnalysisResult = z.infer<typeof AnalysisResult>;

export const FixProposal = z.object({
  summary: z.string(),
  diff: z.string(),
  files: z.array(z.object({ path: z.string(), newContent: z.string() })),
  confidence: Confidence,
});
export type FixProposal = z.infer<typeof FixProposal>;

export const Dossier = z.object({
  reportId: z.string(),
  appId: z.string(),
  repo: z.string().optional(),
  triage: TriageResult.optional(),
  analysis: AnalysisResult.optional(),
  retrievedFiles: z
    .array(z.object({ path: z.string(), content: z.string() }))
    .optional(),
  fix: FixProposal.optional(),
  prUrl: z.string().optional(),
  costUsd: z.number().default(0),
  notes: z.array(z.string()).default([]),
  haltedReason: z.string().optional(),
});
export type Dossier = z.infer<typeof Dossier>;
