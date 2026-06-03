import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("html2canvas", () => ({
  default: vi.fn(async () => {
    const canvas = {
      toDataURL: () => "data:image/png;base64,fake",
    };
    return canvas;
  }),
}));

describe("buffer instrumentation", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("captures window error in snapshot after install", async () => {
    const { install, snapshot } = await import("./buffer");
    install();

    window.dispatchEvent(
      new ErrorEvent("error", {
        message: "test boom",
        error: new Error("test boom"),
        filename: "app.js",
        lineno: 1,
        colno: 1,
      }),
    );

    await new Promise((r) => setTimeout(r, 10));
    const snap = snapshot();
    expect(snap.errors.some((e) => e.message.includes("test boom"))).toBe(true);
  });
});
