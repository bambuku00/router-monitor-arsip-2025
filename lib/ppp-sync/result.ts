import type { PppSyncStatus } from "@prisma/client";

/** Client-safe sync metadata shape (shared by server actions and UI). */
export type PppSyncTimeSnapshot = {
  id: number;
  routerId: number;
  updated: Date;
  lastSyncStartedAt: Date | null;
  lastSyncCompletedAt: Date | null;
  lastSyncStatus: PppSyncStatus | null;
  lastSyncError: string | null;
  lastSyncSecrets: number | null;
  lastSyncActives: number | null;
  syncInProgress: boolean;
};

export type ExecutePppSyncResult =
  | {
      data: {
        addTotal: number;
        syncTime: PppSyncTimeSnapshot;
      };
    }
  | { error: string; skippedLock?: boolean };

export function isPppSyncError(
  result: ExecutePppSyncResult
): result is { error: string; skippedLock?: boolean } {
  return "error" in result;
}
