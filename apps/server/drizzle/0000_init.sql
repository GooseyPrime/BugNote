CREATE TABLE IF NOT EXISTS "reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "app_id" text NOT NULL,
  "status" text DEFAULT 'received' NOT NULL,
  "severity" text DEFAULT 'medium' NOT NULL,
  "signature" text NOT NULL,
  "note" text,
  "context" jsonb NOT NULL,
  "console_log" jsonb NOT NULL,
  "errors" jsonb NOT NULL,
  "breadcrumbs" jsonb NOT NULL,
  "screenshot_url" text,
  "dossier" jsonb,
  "pr_url" text,
  "dup_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "report_id" uuid NOT NULL,
  "stage" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "run_after" timestamp with time zone DEFAULT now() NOT NULL,
  "locked_at" timestamp with time zone,
  "last_error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "reports_app_idx" ON "reports" ("app_id");
CREATE INDEX IF NOT EXISTS "reports_sig_idx" ON "reports" ("app_id", "signature");
CREATE INDEX IF NOT EXISTS "jobs_claim_idx" ON "jobs" ("status", "run_after");
