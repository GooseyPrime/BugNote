import type { FastifyReply, FastifyRequest } from "fastify";
import { verifyToken } from "@clerk/backend";
import { env } from "../config/index.js";

export async function requireAuth(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || !env.CLERK_SECRET_KEY) {
    return reply.code(401).send({ error: "unauthorized" });
  }
  try {
    const payload = await verifyToken(token, {
      secretKey: env.CLERK_SECRET_KEY,
    });
    (req as FastifyRequest & { userId?: string }).userId = payload.sub;
  } catch {
    return reply.code(401).send({ error: "unauthorized" });
  }
}
