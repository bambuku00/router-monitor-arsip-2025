import {
  getPPP,
  revalidatePPP,
  type GetPPP,
} from "@/lib/server-actions/router/ppp/actions";

export type PppPageLogPhase =
  | "page_load"
  | "auto_sync_start"
  | "auto_sync_success"
  | "auto_sync_error"
  | "manual_sync_start"
  | "manual_sync_success"
  | "manual_sync_error"
  | "data_refetch_start"
  | "data_refetch_success"
  | "data_refetch_error"
  | "table_state_updated";

/** Logging sementara (dev) — aman, tanpa kredensial. */
export function logPppPageEvent(
  phase: PppPageLogPhase,
  extra?: Record<string, unknown>
): void {
  const payload = { msg: "[PPP Page]", phase, ...extra };
  if (process.env.NODE_ENV !== "production") {
    console.info(JSON.stringify(payload));
  }
}

const autoSyncInflight = new Set<number>();
const autoSyncCompleted = new Set<number>();

/** Klaim auto sync sekali per kunjungan tab (cegah overlap dan ulang setelah refresh). */
export function claimPppAutoSync(routerId: number): boolean {
  if (autoSyncCompleted.has(routerId) || autoSyncInflight.has(routerId)) {
    return false;
  }
  autoSyncInflight.add(routerId);
  return true;
}

export function releasePppAutoSync(
  routerId: number,
  outcome: "success" | "error" | "cancelled"
): void {
  autoSyncInflight.delete(routerId);
  if (outcome === "success") {
    autoSyncCompleted.add(routerId);
  }
}

/** Reset klaim. Dipakai tes dan saat perlu mengizinkan auto sync lagi. */
export function clearPppAutoSyncSession(routerId: number): void {
  autoSyncCompleted.delete(routerId);
  autoSyncInflight.delete(routerId);
}

export type RefreshPppTableResult = {
  data: GetPPP["data"];
  syncTime: GetPPP["syncTime"];
  totalTagih: GetPPP["totalTagih"];
};

/**
 * Setelah sync backend sukses: revalidate tag + ambil data terbaru dari DB.
 * Dipakai auto sync dan manual sync (alur sama).
 */
export async function refreshPppTableAfterSync(
  routerId: number,
  source: "auto" | "manual"
): Promise<RefreshPppTableResult> {
  logPppPageEvent("data_refetch_start", { routerId, source });

  const reval = await revalidatePPP();
  if ("error" in reval && reval.error) {
    logPppPageEvent("data_refetch_error", {
      routerId,
      source,
      error: reval.error,
    });
    throw new Error(reval.error);
  }

  const result = await getPPP(routerId);
  if ("error" in result) {
    logPppPageEvent("data_refetch_error", {
      routerId,
      source,
      error: result.error,
    });
    throw new Error(result.error);
  }

  logPppPageEvent("data_refetch_success", {
    routerId,
    source,
    rowCount: result.data?.length ?? 0,
  });
  logPppPageEvent("table_state_updated", { routerId, source });

  return {
    data: result.data,
    syncTime: result.syncTime,
    totalTagih: result.totalTagih,
  };
}
