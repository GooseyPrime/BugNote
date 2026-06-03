import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FastifyReply, FastifyRequest } from "fastify";

const { verifyIdToken } = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
}));

vi.mock("google-auth-library", () => ({
  OAuth2Client: class MockOAuth2Client {
    verifyIdToken = verifyIdToken;
  },
}));

vi.mock("../config/index.js", () => ({
  env: {
    GOOGLE_OAUTH_CLIENT_ID: "test-client.apps.googleusercontent.com",
    ADMIN_ALLOWED_EMAILS: "admin@example.com",
  },
}));

function mockReply() {
  const reply = {
    code: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  };
  return reply as unknown as FastifyReply & {
    code: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
  };
}

function mockReq(auth?: string): FastifyRequest {
  return {
    headers: auth ? { authorization: auth } : {},
  } as FastifyRequest;
}

describe("requireAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without Authorization", async () => {
    const { requireAuth } = await import("./auth.js");
    const reply = mockReply();
    await requireAuth(mockReq(), reply);
    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({ error: "unauthorized" });
  });

  it("returns 403 when email_verified is false for allowlisted email", async () => {
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email: "admin@example.com",
        email_verified: false,
      }),
    });
    const { requireAuth } = await import("./auth.js");
    const reply = mockReply();
    await requireAuth(mockReq("Bearer fake-token"), reply);
    expect(reply.code).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith({ error: "forbidden" });
  });

  it("returns 403 for verified email not on allowlist", async () => {
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email: "other@example.com",
        email_verified: true,
      }),
    });
    const { requireAuth } = await import("./auth.js");
    const reply = mockReply();
    await requireAuth(mockReq("Bearer fake-token"), reply);
    expect(reply.code).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith({ error: "forbidden" });
  });

  it("allows allowlisted verified email", async () => {
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email: "admin@example.com",
        email_verified: true,
      }),
    });
    const { requireAuth } = await import("./auth.js");
    const req = mockReq("Bearer valid-token");
    const reply = mockReply();
    await requireAuth(req, reply);
    expect(reply.code).not.toHaveBeenCalled();
    expect((req as FastifyRequest & { userEmail?: string }).userEmail).toBe(
      "admin@example.com",
    );
  });

  it("returns 403 when email is missing from token payload", async () => {
    verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email_verified: true,
      }),
    });
    const { requireAuth } = await import("./auth.js");
    const reply = mockReply();
    await requireAuth(mockReq("Bearer fake-token"), reply);
    expect(reply.code).toHaveBeenCalledWith(403);
  });

  it("returns 401 when verifyIdToken throws", async () => {
    verifyIdToken.mockRejectedValue(new Error("invalid token"));
    const { requireAuth } = await import("./auth.js");
    const reply = mockReply();
    await requireAuth(mockReq("Bearer bad-token"), reply);
    expect(reply.code).toHaveBeenCalledWith(401);
  });
});
