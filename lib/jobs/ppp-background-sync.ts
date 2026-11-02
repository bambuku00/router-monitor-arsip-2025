import { randomUUID } from "node:crypto";
import prisma from "@/lib/prisma";
import {
  isRouterEligibleForBackgroundSync,
  type PppSyncActor,
} from "@/lib/ppp-sync/core";
import { executePppSync } from "@/lib/ppp-sync/execute";
import {
  acquireNamedJobLock,
  PPP_BACKGROUND_GLOBAL_LOCK_TTL_MS,
  PPP_BACKGROUND_LOCK_NAME,
  releaseNamedJobLock,
} from "@/lib/ppp-sync/lock";
import { logger } from "@/lib/logger";
import { restoreExpiredPppBoosters } from "@/lib/ppp-booster-apply";

export type BackgroundPppSyncRouterResult = {
  routerId: number;
  status: "success" | "failed" | "skipped";
  error?: string;
  skippedLock?: boolean;
};

export type BackgroundPppSyncJobResult = {
  batchId: string;
  skippedGlobalLock: boolean;
  total: number;
  success: number;
  failed: number;
  skipped: number;
  routers: BackgroundPppSyncRouterResult[];
};

const BACKGROUND_ACTOR: PppSyncActor = "system";

export async function runBackgroundPppSyncJob(): Promise<BackgroundPppSyncJobResult> {
  const batchId = randomUUID();
  const globalOwner = `ppp-background:${batchId}`;

  logger.info({ msg: "background_ppp_sync_start", batchId });

  const locked = await acquireNamedJobLock(
    PPP_BACKGROUND_LOCK_NAME,
    globalOwner,
    PPP_BACKGROUND_GLOBAL_LOCK_TTL_MS
  );

  if (!locked) {
    logger.info({ msg: "background_ppp_sync_complete", batchId, skippedGlobalLock: true });
    logger.info({ msg: "BACKGROUND_JOB_COMPLETE", batchId, skippedGlobalLock: true });
    return {
      batchId,
      skippedGlobalLock: true,
      total: 0,
      success: 0,
      failed: 0,
      skipped: 0,
      routers: [],
    };
  }

  try {
    await restoreExpiredPppBoosters();
  } catch (err) {
    logger.warn({
      msg: "restore ppp booster before background sync failed",
      batchId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const routers = await prisma.router.findMany({
    where: { deleted: false },
    select: {
      id: true,
      deleted: true,
      host: true,
      port: true,
      user: true,
      password: true,
    },
    orderBy: { id: "asc" },
  });

  const eligible = routers.filter(isRouterEligibleForBackgroundSync);
  const results: BackgroundPppSyncRouterResult[] = [];

  try {
    for (const router of eligible) {
      const outcome = await executePppSync({
        routerId: router.id,
        mode: "full",
        source: "background",
        actor: BACKGROUND_ACTOR,
        lockOwner: `${globalOwner}:router:${router.id}`,
      });

      if ("skippedLock" in outcome && outcome.skippedLock) {
        results.push({
          routerId: router.id,
          status: "skipped",
          skippedLock: true,
          error: outcome.error,
        });
        continue;
      }

      if ("error" in outcome) {
        results.push({
          routerId: router.id,
          status: "failed",
          error: outcome.error,
        });
        continue;
      }

      results.push({ routerId: router.id, status: "success" });
    }
  } finally {
    await releaseNamedJobLock(PPP_BACKGROUND_LOCK_NAME, globalOwner);
  }

  const success = results.filter((r) => r.status === "success").length;
  const failed = results.filter((r) => r.status === "failed").length;
  const skipped = results.filter((r) => r.status === "skipped").length;

  logger.info({
    msg: "background_ppp_sync_complete",
    batchId,
    total: eligible.length,
    success,
    failed,
    skipped,
  });
  logger.info({
    msg: "BACKGROUND_JOB_COMPLETE",
    batchId,
    total: eligible.length,
    success,
    failed,
    skipped,
  });

  return {
    batchId,
    skippedGlobalLock: false,
    total: eligible.length,
    success,
    failed,
    skipped,
    routers: results,
  };
}
