import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { env } from "./config/index.js";
import { registerIngest } from "./api/ingest.js";
import { registerHealth } from "./api/health.js";
import { registerAdmin } from "./api/admin.js";

const app = Fastify({ logger: true, bodyLimit: 8 * 1024 * 1024 });

await app.register(cors, {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (env.INGEST_ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    if (env.ADMIN_ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error("CORS not allowed"), false);
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});

await app.register(rateLimit, {
  max: env.INGEST_RATE_LIMIT_PER_MIN,
  timeWindow: "1 minute",
  allowList: (req) => req.url.startsWith("/v1/admin") || req.url === "/health",
});

registerHealth(app);
registerIngest(app);
registerAdmin(app);

await app.listen({ port: env.PORT, host: "0.0.0.0" });
