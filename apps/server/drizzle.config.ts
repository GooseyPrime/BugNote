import type { Config } from "drizzle-kit";

// placeholder — implemented in Document 2 (Cursor)
export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env["DATABASE_URL"] ?? "",
  },
} satisfies Config;
