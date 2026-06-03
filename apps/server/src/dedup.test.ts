import { describe, expect, it } from "vitest";
import type { BugReportPayload } from "@bugnote/shared";
import { computeSignature } from "./dedup.js";

const basePayload: BugReportPayload = {
  appId: "testapp",
  severity: "medium",
  context: {
    url: "https://example.com",
    userAgent: "ua",
    viewport: { w: 100, h: 100 },
    sessionId: "s1",
  },
  console: [],
  errors: [
    {
      ts: 1,
      kind: "error",
      name: "TypeError",
      message: "Cannot read property x of undefined at line 42",
      stack: "TypeError: x\n  at https://example.com/app.js:10:5",
    },
  ],
  breadcrumbs: [],
};

describe("computeSignature", () => {
  it("is stable for the same error", () => {
    const a = computeSignature(basePayload);
    const b = computeSignature(basePayload);
    expect(a).toBe(b);
    expect(a).toHaveLength(32);
  });

  it("differs when message changes", () => {
    const other: BugReportPayload = {
      ...basePayload,
      errors: [
        {
          ...basePayload.errors[0]!,
          message: "totally different",
        },
      ],
    };
    expect(computeSignature(other)).not.toBe(computeSignature(basePayload));
  });
});
