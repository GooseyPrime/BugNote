import type { FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";
import { db } from "../db/client.js";

export function registerHealth(app: FastifyInstance) {
  app.get("/health", async (_req, reply) => {
    try {
      await db.execute(sql`SELECT 1`);
      return { ok: true, db: "up" };
    } catch {
      return reply.code(503).send({ ok: false, db: "down" });
    }
  });
}
