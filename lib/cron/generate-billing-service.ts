import {
  runScheduledBillingGenerate,
  type ScheduledBillingGenerateResult,
} from "@/lib/jobs/generate-payments";
import { logger } from "@/lib/logger";

export type CronGenerateBillingSuccess = {
  ok: true;
} & ScheduledBillingGenerateResult;

export type CronGenerateBillingErrorBody = {
  error: string;
};

/** Shared entry point for cron generate billing (API + CLI). */
export async function executeCronGenerateBilling(): Promise<CronGenerateBillingSuccess> {
  const result = await runScheduledBillingGenerate();
  logger.info({ msg: "Cron generate billing", result });
  return { ok: true, ...result };
}

export const CRON_GENERATE_BILLING_ERROR_MESSAGE =
  "Gagal menjalankan generate billing.";
