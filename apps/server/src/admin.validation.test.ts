import { describe, expect, it } from "vitest";
import { ReportStatus, PipelineStage } from "@bugnote/shared";

const MAX = 200;
const DEFAULT = 50;

function parseReportLimit(raw: string | undefined): number {
  const n = Number(raw ?? DEFAULT);
  if (!Number.isFinite(n) || n < 1) return DEFAULT;
  return Math.min(Math.floor(n), MAX);
}

describe("admin input guards", () => {
  it("rejects invalid ReportStatus", () => {
    expect(ReportStatus.safeParse("banana").success).toBe(false);
    expect(ReportStatus.safeParse("queued").success).toBe(true);
  });

  it("rejects invalid PipelineStage", () => {
    expect(PipelineStage.safeParse("nonexistent").success).toBe(false);
    expect(PipelineStage.safeParse("triage").success).toBe(true);
  });

  it("caps report list limit", () => {
    expect(parseReportLimit("999999")).toBe(200);
    expect(parseReportLimit("abc")).toBe(50);
    expect(parseReportLimit("0")).toBe(50);
  });
});
