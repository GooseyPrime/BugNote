import { describe, expect, it } from "vitest";
import { scrubString } from "./scrub";

describe("scrubString", () => {
  it("redacts JWT-like tokens", () => {
    const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc";
    expect(scrubString(`token ${jwt}`)).toContain("[jwt]");
    expect(scrubString(`token ${jwt}`)).not.toContain("eyJ");
  });
});
