import type { FastifyReply, FastifyRequest } from "fastify";
import { OAuth2Client } from "google-auth-library";
import { env } from "../config/index.js";

const client = new OAuth2Client();
const ALLOWED = env.ADMIN_ALLOWED_EMAILS.split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const token = (req.headers.authorization ?? "").replace(/^Bearer /, "");
  if (!token) return reply.code(401).send({ error: "unauthorized" });
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: env.GOOGLE_OAUTH_CLIENT_ID,
    });
    const p = ticket.getPayload();
    const email = (p?.email ?? "").trim().toLowerCase();
    if (!p?.email_verified || !email || !ALLOWED.includes(email)) {
      return reply.code(403).send({ error: "forbidden" });
    }
    (req as FastifyRequest & { userEmail?: string }).userEmail = p.email;
  } catch {
    return reply.code(401).send({ error: "unauthorized" });
  }
}
