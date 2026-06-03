import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  integer,
  index,
} from "drizzle-orm/pg-core";

export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    appId: text("app_id").notNull(),
    status: text("status").notNull().default("received"),
    severity: text("severity").notNull().default("medium"),
    signature: text("signature").notNull(),
    note: text("note"),
    context: jsonb("context").notNull(),
    consoleLog: jsonb("console_log").notNull(),
    errors: jsonb("errors").notNull(),
    breadcrumbs: jsonb("breadcrumbs").notNull(),
    screenshotUrl: text("screenshot_url"),
    dossier: jsonb("dossier"),
    prUrl: text("pr_url"),
    dupCount: integer("dup_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    byApp: index("reports_app_idx").on(t.appId),
    bySig: index("reports_sig_idx").on(t.appId, t.signature),
  }),
);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reportId: uuid("report_id").notNull(),
    stage: text("stage").notNull(),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    runAfter: timestamp("run_after", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    claim: index("jobs_claim_idx").on(t.status, t.runAfter),
  }),
);
