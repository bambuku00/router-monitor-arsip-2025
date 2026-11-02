import { logger } from "@/lib/logger";
import {
  bulkFillPelangganFromPpp,
  formatBulkFillPelangganSummary,
  hasDailyAutoFillRunToday,
  logDailyAutoFillRun,
} from "@/lib/ppp-bulk-fill-pelanggan";
import prisma from "@/lib/prisma";

export type DailyAutoFillOutcome =
  | { status: "skipped_already_ran" }
  | { status: "skipped_no_owner" }
  | { status: "skipped_disabled_for_owner" }
  | { status: "completed"; summary: string };

/**
 * Auto Isi otomatis maksimal 1× per hari per router (setelah sync background sukses).
 * Mode automatic — tanpa defaultPaketId interaktif.
 */
export async function maybeRunDailyAutoFillAfterPppSync(
  routerId: number
): Promise<DailyAutoFillOutcome> {
  logger.info({ msg: "AUTO_FILL_START", routerId });

  const router = await prisma.router.findUnique({
    where: { id: routerId },
    select: {
      userId: true,
      users: { select: { pppAutoFillEnabled: true } },
    },
  });

  if (router?.userId == null) {
    logger.info({
      msg: "AUTO_FILL_SKIP",
      routerId,
      reason: "no_owner",
    });
    return { status: "skipped_no_owner" };
  }

  const ownerUserId = router.userId;

  if (router.users?.pppAutoFillEnabled !== true) {
    logger.info({
      msg: "AUTO_FILL_SKIP",
      routerId,
      ownerUserId,
      reason: "disabled_for_owner",
    });
    return { status: "skipped_disabled_for_owner" };
  }

  if (await hasDailyAutoFillRunToday(routerId)) {
    logger.info({
      msg: "AUTO_FILL_SKIP",
      routerId,
      ownerUserId,
      reason: "already_ran_today",
    });
    return { status: "skipped_already_ran" };
  }

  try {
    const result = await bulkFillPelangganFromPpp(routerId, ownerUserId, {
      mode: "automatic",
    });

    await logDailyAutoFillRun({ routerId, ownerUserId, result });

    const summary = formatBulkFillPelangganSummary(result);
    logger.info({
      msg: "AUTO_FILL_SUCCESS",
      routerId,
      ownerUserId,
      created: result.created,
      linked: result.linked,
      skips: result.skips,
      summary,
    });

    return { status: "completed", summary };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({
      msg: "AUTO_FILL_FAILED",
      routerId,
      ownerUserId,
      error: message,
    });
    throw err;
  }
}
