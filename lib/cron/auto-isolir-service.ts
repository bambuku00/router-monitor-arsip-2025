import {
  runAutoIsolirJob,
  type AutoIsolirJobResult,
} from "@/lib/jobs/auto-isolir";
import { restoreExpiredPppBoosters } from "@/lib/ppp-booster-apply";
import { logger } from "@/lib/logger";

export type CronAutoIsolirSuccess = {
  ok: true;
} & AutoIsolirJobResult;

export type CronAutoIsolirConflict = {
  ok: false;
  error: string;
} & AutoIsolirJobResult;

export type CronAutoIsolirResponse =
  | CronAutoIsolirSuccess
  | CronAutoIsolirConflict;

export type CronAutoIsolirErrorBody = {
  error: string;
};

export const CRON_AUTO_ISOLIR_CONFLICT_MESSAGE =
  "Job auto isolir sedang berjalan";

export const CRON_AUTO_ISOLIR_ERROR_MESSAGE =
  "Gagal menjalankan auto isolir.";

/** Shared entry point for cron auto isolir (API + CLI). */
export async function executeCronAutoIsolir(): Promise<CronAutoIsolirResponse> {
  const result = await runAutoIsolirJob();
  try {
    await restoreExpiredPppBoosters();
  } catch (err) {
    logger.warn({
      msg: "restore ppp booster from auto isolir failed",
      error: err instanceof Error ? err.message : String(err),
    });
  }
  if (result.skippedLock) {
    return {
      ok: false,
      error: CRON_AUTO_ISOLIR_CONFLICT_MESSAGE,
      ...result,
    };
  }
  return { ok: true, ...result };
}
