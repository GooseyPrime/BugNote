import { claimNext, complete, fail } from "./queue/index.js";
import { runStage } from "./agents/index.js";
import type { PipelineStage } from "@bugnote/shared";
import pino from "pino";

const log = pino({ name: "bugnote-worker" });

async function loop() {
  for (;;) {
    const job = await claimNext();
    if (!job) {
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }
    try {
      await runStage(job.stage as PipelineStage, job.report_id);
      await complete(job.id);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "unknown";
      log.error({ jobId: job.id, stage: job.stage, err: msg }, "stage failed");
      await fail(job.id, job.attempts, msg);
    }
  }
}

loop().catch((e) => {
  log.error(e);
  process.exit(1);
});
