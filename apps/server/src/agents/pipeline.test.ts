import { beforeEach, describe, expect, it, vi } from "vitest";
import { BudgetExceeded } from "./guards.js";

vi.mock("./openrouter.js", () => ({
  chat: vi.fn(),
  parseJson: (t: string) => JSON.parse(t),
}));

vi.mock("@bugnote/github-app", () => ({
  retrieveFiles: vi.fn(async () => []),
  searchCode: vi.fn(async () => []),
  openDraftPr: vi.fn(),
}));

vi.mock("./dossier.js", () => ({
  loadDossier: vi.fn(),
  saveDossier: vi.fn(),
}));

vi.mock("../queue/index.js", () => ({
  enqueue: vi.fn(),
}));

describe("runStage budget halt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists failed status on BudgetExceeded without rethrowing", async () => {
    const { loadDossier, saveDossier } = await import("./dossier.js");
    const { runStage } = await import("./pipeline.js");
    const { chat } = await import("./openrouter.js");

    vi.mocked(loadDossier).mockResolvedValue({
      report: {
        id: "r1",
        app_id: "app",
        status: "queued",
        note: null,
        context: {},
        console_log: [],
        errors: [{ message: "err" }],
        breadcrumbs: [],
        screenshot_url: null,
        dossier: null,
        pr_url: null,
      },
      dossier: {
        reportId: "r1",
        appId: "app",
        repo: "o/r",
        costUsd: 0,
        notes: [],
      },
    });

    vi.mocked(chat).mockImplementation(async () => {
      throw new BudgetExceeded("over budget");
    });

    await expect(runStage("triage", "r1")).resolves.toBeUndefined();
    expect(saveDossier).toHaveBeenCalledWith(
      "r1",
      expect.objectContaining({ haltedReason: expect.stringContaining("budget") }),
      "failed",
    );
  });
});
