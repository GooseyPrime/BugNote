import type { FastifyReply, FastifyRequest } from "fastify";
import { OAuth2Client } from "google-auth-library";
import { env } from "../config/index.js";

const client = new OAuth2Client();
const ALLOWED = env.ADMIN_ALLOWED_EMAILS.split(",").map((s) => s.trim().toLowerCase());

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const token = (req.headers.authorization ?? "").replace(/^Bearer /, "");
  if (!token) return reply.code(401).send({ error: "unauthorized" });
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: env.GOOGLE_OAUTH_CLIENT_ID,
    });
    const p = ticket.getPayload();
    if (!p?.email_verified || !ALLOWED.includes((p.email ?? "").toLowerCase())) {
      return reply.code(403).send({ error: "forbidden" });
    }
    (req as FastifyRequest & { userEmail?: string }).userEmail = p.email;
  } catch {
    return reply.code(401).send({ error: "unauthorized" });
  }
}
