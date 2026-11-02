import { randomUUID } from "node:crypto";
import prisma from "@/lib/prisma";
import {
  loadPppSyncRouter,
  pppRouterConnectErrorMessage,
  runFullPppSyncCore,
  runRealtimePppSyncCore,
  type PppSyncActor,
} from "@/lib/ppp-sync/core";
import {
  acquireRouterPppSyncLock,
  releaseRouterPppSyncLock,
} from "@/lib/ppp-sync/lock";
import {
  markPppSyncFinished,
  markPppSyncSkipped,
  markPppSyncStarted,
} from "@/lib/ppp-sync/metadata";
import { logger } from "@/lib/logger";
import type { PppSyncStatus } from "@prisma/client";
import {
  type ExecutePppSyncResult,
} from "@/lib/ppp-sync/result";

export type { ExecutePppSyncResult, PppSyncTimeSnapshot } from "@/lib/ppp-sync/result";
export { isPppSyncError } from "@/lib/ppp-sync/result";

export type PppSyncSource = "manual" | "auto" | "background";

export type ExecutePppSyncParams = {
  routerId: number;
  mode: "full" | "realtime";
  source: PppSyncSource;
  actor: PppSyncActor;
  /** Override lock owner (tests). */
  lockOwner?: string;
  /** Skip lock acquire/release (tests only). */
  skipLock?: boolean;
};

function lockOwnerFor(params: ExecutePppSyncParams): string {
  return params.lockOwner ?? `${params.source}:${params.mode}:${randomUUID()}`;
}

function sessionLabel(params: ExecutePppSyncParams): string {
  const prefix =
    params.mode === "full"
      ? params.source === "background"
        ? "backgroundPppSync"
        : "syncPPP"
      : "realtimeSyncPPP";
  return `${prefix}:${params.routerId}`;
}

export async function executePppSync(
  params: ExecutePppSyncParams
): Promise<ExecutePppSyncResult> {
  const owner = lockOwnerFor(params);
  const label = sessionLabel(params);

  if (!params.skipLock) {
    const locked = await acquireRouterPppSyncLock(params.routerId, owner);
    if (!locked) {
      logger.info({
        msg: "router_sync_skipped_locked",
        routerId: params.routerId,
        source: params.source,
        mode: params.mode,
      });
      await markPppSyncSkipped(params.routerId);
      return {
        error: "Sinkronisasi router sedang berjalan. Coba lagi sebentar.",
        skippedLock: true,
      };
    }
  }

  try {
    await markPppSyncStarted(params.routerId);

    const router = await loadPppSyncRouter(params.routerId);
    if (!router) {
      await markPppSyncFinished(params.routerId, {
        lastSyncCompletedAt: new Date(),
        lastSyncStatus: "failed",
        lastSyncError: "Router tidak ditemukan",
        syncInProgress: false,
      });
      return { error: "Router tidak ditemukan" };
    }

    logger.info({
      msg: "PPP_SYNC_START",
      routerId: params.routerId,
      source: params.source,
      mode: params.mode,
    });
    logger.info({
      msg: "router_sync_start",
      routerId: params.routerId,
      source: params.source,
      mode: params.mode,
    });

    const coreResult =
      params.mode === "full"
        ? await runFullPppSyncCore(router, label, params.actor)
        : await runRealtimePppSyncCore(router, label, params.actor);

    if (!coreResult.ok) {
      await markPppSyncFinished(params.routerId, {
        lastSyncCompletedAt: new Date(),
        lastSyncStatus: "failed",
        lastSyncError: coreResult.error,
        syncInProgress: false,
      });
      logger.warn({
        msg: "router_sync_failed",
        routerId: params.routerId,
        source: params.source,
        mode: params.mode,
        error: coreResult.error,
      });
      return { error: coreResult.error };
    }

    const status: PppSyncStatus =
      coreResult.secretsCreated > 0 || coreResult.activesCreated > 0
        ? "success"
        : "success";

    await markPppSyncFinished(params.routerId, {
      lastSyncCompletedAt: new Date(),
      lastSyncStatus: status,
      lastSyncError: null,
      lastSyncSecrets: coreResult.secretsCreated + coreResult.secretsUpdated,
      lastSyncActives: coreResult.activesCreated + coreResult.activesUpdated,
      syncInProgress: false,
    });

    const syncTime = await prisma.pppSync.findUnique({
      where: { routerId: params.routerId },
    });

    logger.info({
      msg: "PPP_SYNC_SUCCESS",
      routerId: params.routerId,
      source: params.source,
      mode: params.mode,
      secretsCreated: coreResult.secretsCreated,
      activesCreated: coreResult.activesCreated,
    });
    logger.info({
      msg: "router_sync_success",
      routerId: params.routerId,
      source: params.source,
      mode: params.mode,
      secretsCreated: coreResult.secretsCreated,
      activesCreated: coreResult.activesCreated,
    });

    if (params.mode === "full" && params.source === "background") {
      const { maybeRunDailyAutoFillAfterPppSync } = await import(
        "@/lib/ppp-auto-fill-daily"
      );
      try {
        await maybeRunDailyAutoFillAfterPppSync(params.routerId);
      } catch {
        // AUTO_FILL_FAILED sudah dilog di maybeRunDailyAutoFillAfterPppSync
      }
    }

    return {
      data: {
        addTotal: coreResult.addTotal,
        syncTime: syncTime!,
      },
    };
  } catch (err) {
    const error = err as Error & { code?: string };
    const message = pppRouterConnectErrorMessage(error);
    await markPppSyncFinished(params.routerId, {
      lastSyncCompletedAt: new Date(),
      lastSyncStatus: "failed",
      lastSyncError: message,
      syncInProgress: false,
    }).catch(() => {});
    logger.warn({
      msg: "router_sync_failed",
      routerId: params.routerId,
      source: params.source,
      mode: params.mode,
      error: message,
    });
    return { error: message };
  } finally {
    if (!params.skipLock) {
      await releaseRouterPppSyncLock(params.routerId, owner);
    }
  }
}
