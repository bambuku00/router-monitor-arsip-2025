import prisma from "@/lib/prisma";
import type { PppSyncStatus } from "@prisma/client";
import { sanitizePppSyncError } from "@/lib/ppp-sync/sanitize-error";

export type PppSyncMetadataPatch = {
  lastSyncStartedAt?: Date | null;
  lastSyncCompletedAt?: Date | null;
  lastSyncStatus?: PppSyncStatus | null;
  lastSyncError?: string | null;
  lastSyncSecrets?: number | null;
  lastSyncActives?: number | null;
  syncInProgress?: boolean;
};

export async function markPppSyncStarted(routerId: number): Promise<void> {
  const now = new Date();
  await prisma.pppSync.upsert({
    where: { routerId },
    create: {
      routerId,
      lastSyncStartedAt: now,
      syncInProgress: true,
      lastSyncStatus: null,
      lastSyncError: null,
    },
    update: {
      lastSyncStartedAt: now,
      syncInProgress: true,
      lastSyncError: null,
    },
  });
}

export async function markPppSyncFinished(
  routerId: number,
  patch: PppSyncMetadataPatch
): Promise<void> {
  await prisma.pppSync.upsert({
    where: { routerId },
    create: {
      routerId,
      ...patch,
      lastSyncError: patch.lastSyncError
        ? sanitizePppSyncError(patch.lastSyncError)
        : null,
    },
    update: {
      ...patch,
      lastSyncError: patch.lastSyncError
        ? sanitizePppSyncError(patch.lastSyncError)
        : patch.lastSyncError === null
          ? null
          : undefined,
    },
  });
}

export async function markPppSyncSkipped(routerId: number): Promise<void> {
  const now = new Date();
  await prisma.pppSync.upsert({
    where: { routerId },
    create: {
      routerId,
      lastSyncStartedAt: now,
      lastSyncCompletedAt: now,
      lastSyncStatus: "skipped",
      syncInProgress: false,
    },
    update: {
      lastSyncCompletedAt: now,
      lastSyncStatus: "skipped",
      syncInProgress: false,
    },
  });
}
