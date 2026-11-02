import { runAutoIsolation } from "@/lib/auto-isolir/run";
import { logger } from "@/lib/logger";

export type AutoIsolirJobResult = Awaited<ReturnType<typeof runAutoIsolation>>;

export async function runAutoIsolirJob(): Promise<AutoIsolirJobResult> {
  const result = await runAutoIsolation({ executedBy: "system" });
  logger.info({
    msg: "Auto isolir job selesai",
    batchId: result.batchId,
    processed: result.processed,
    success: result.success,
    failed: result.failed,
    skipped: result.skipped,
    skippedLock: result.skippedLock,
  });
  return result;
}
