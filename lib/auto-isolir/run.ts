import {
  getEnabledMitraUserIds,
  getJakartaDateString,
  getOverdueCustomers,
  getAutoIsolirSettings,
  isExecuteTimeDue,
  type OverdueCustomerCandidate,
} from "@/lib/auto-isolir/overdue";
import { acquireJobLock, newBatchId, releaseJobLock } from "@/lib/auto-isolir/lock";
import {
  isolateCustomer,
  loadRouterCredentials,
  restoreCustomer,
  type IsolirOperationResult,
} from "@/lib/ppp-isolir-service";
import { isPppIsolir } from "@/lib/ppp-isolir";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { AutoIsolirLogStatus } from "@prisma/client";

export type AutoIsolirRunOptions = {
  userId?: number;
  dryRun?: boolean;
  executedBy?: string;
  skipLock?: boolean;
  force?: boolean;
  /**
   * H9: when set, only these pelanggan IDs may be isolated.
   * Used for restricted staff (StaffPelangganScope). Undefined = no extra filter
   * (Superadmin / Admin / unrestricted staff / cron).
   */
  pelangganIdAllowList?: number[];
};

export type AutoIsolirRunItem = {
  pelangganId: number;
  pelangganNama: string;
  pppUsername: string;
  pembayaranId: number;
  jatuh_tempo: string;
  status: AutoIsolirLogStatus;
  errorMessage?: string;
  oldProfile?: string;
  newProfile?: string;
};

export type AutoIsolirRunResult = {
  batchId: string;
  dryRun: boolean;
  skippedLock?: boolean;
  processed: number;
  success: number;
  failed: number;
  skipped: number;
  items: AutoIsolirRunItem[];
};

async function logAutoIsolirEntry(params: {
  userId: number;
  candidate: OverdueCustomerCandidate;
  action: "isolate" | "restore";
  status: AutoIsolirLogStatus;
  batchId: string;
  dryRun: boolean;
  executedBy: string;
  result?: IsolirOperationResult;
}) {
  if (params.dryRun) return;

  await prisma.autoIsolirLog.create({
    data: {
      userId: params.userId,
      pelangganId: params.candidate.pelangganId,
      pembayaranId: params.candidate.pembayaranId,
      pppUsername: params.candidate.pppUsername,
      routerId: params.candidate.routerId,
      dueDate: params.candidate.jatuh_tempo,
      oldProfile: params.result?.oldProfile ?? params.candidate.pppProfile,
      newProfile: params.result?.newProfile,
      action: params.action,
      status: params.status,
      errorMessage: params.result?.error ?? params.result?.skipReason,
      executedBy: params.executedBy,
      dryRun: false,
      batchId: params.batchId,
    },
  });
}

async function processCandidate(
  candidate: OverdueCustomerCandidate,
  opts: { dryRun: boolean; batchId: string; executedBy: string }
): Promise<AutoIsolirRunItem> {
  const router = await loadRouterCredentials(candidate.routerId);
  if (!router) {
    const result: IsolirOperationResult = {
      ok: false,
      error: "Router tidak ditemukan atau sudah dihapus",
    };
    await logAutoIsolirEntry({
      userId: candidate.userId,
      candidate,
      action: "isolate",
      status: "failed",
      batchId: opts.batchId,
      dryRun: opts.dryRun,
      executedBy: opts.executedBy,
      result,
    });
    return {
      pelangganId: candidate.pelangganId,
      pelangganNama: candidate.pelangganNama,
      pppUsername: candidate.pppUsername,
      pembayaranId: candidate.pembayaranId,
      jatuh_tempo: candidate.jatuh_tempo,
      status: "failed",
      errorMessage: result.error,
    };
  }

  const ppp = await prisma.pppSecret.findUnique({
    where: {
      routerId_name: {
        routerId: candidate.routerId,
        name: candidate.pppUsername,
      },
    },
    include: { active_records: true },
  });

  if (!ppp) {
    const result: IsolirOperationResult = {
      ok: false,
      error: "PPP secret tidak ditemukan",
    };
    await logAutoIsolirEntry({
      userId: candidate.userId,
      candidate,
      action: "isolate",
      status: "failed",
      batchId: opts.batchId,
      dryRun: opts.dryRun,
      executedBy: opts.executedBy,
      result,
    });
    return {
      pelangganId: candidate.pelangganId,
      pelangganNama: candidate.pelangganNama,
      pppUsername: candidate.pppUsername,
      pembayaranId: candidate.pembayaranId,
      jatuh_tempo: candidate.jatuh_tempo,
      status: "failed",
      errorMessage: result.error,
    };
  }

  const isolirProfile =
    router.isolirProfileName?.trim() || candidate.settingsProfile;
  if (isPppIsolir(ppp, { isolirProfileName: isolirProfile })) {
    if (!opts.dryRun) {
      await logAutoIsolirEntry({
        userId: candidate.userId,
        candidate,
        action: "isolate",
        status: "skipped",
        batchId: opts.batchId,
        dryRun: false,
        executedBy: opts.executedBy,
        result: { ok: true, skipped: true, skipReason: "Sudah isolir" },
      });
    }
    return {
      pelangganId: candidate.pelangganId,
      pelangganNama: candidate.pelangganNama,
      pppUsername: candidate.pppUsername,
      pembayaranId: candidate.pembayaranId,
      jatuh_tempo: candidate.jatuh_tempo,
      status: "skipped",
      errorMessage: "Sudah isolir",
      oldProfile: ppp.profile,
      newProfile: ppp.profile,
    };
  }

  const op = await isolateCustomer({
    router,
    ppp,
    isolirProfileOverride: candidate.settingsProfile,
    dryRun: opts.dryRun,
  });

  let status: AutoIsolirLogStatus = "failed";
  if (op.ok) {
    status = op.skipped ? "skipped" : "success";
  }

  await logAutoIsolirEntry({
    userId: candidate.userId,
    candidate,
    action: "isolate",
    status,
    batchId: opts.batchId,
    dryRun: opts.dryRun,
    executedBy: opts.executedBy,
    result: op,
  });

  return {
    pelangganId: candidate.pelangganId,
    pelangganNama: candidate.pelangganNama,
    pppUsername: candidate.pppUsername,
    pembayaranId: candidate.pembayaranId,
    jatuh_tempo: candidate.jatuh_tempo,
    status,
    errorMessage: op.error ?? op.skipReason,
    oldProfile: op.oldProfile,
    newProfile: op.newProfile,
  };
}

export async function runAutoIsolation(
  options: AutoIsolirRunOptions = {}
): Promise<AutoIsolirRunResult> {
  const dryRun = options.dryRun ?? false;
  const executedBy = options.executedBy ?? "system";
  const batchId = newBatchId();
  const lockOwner = `auto-isolir:${batchId}`;

  if (!options.skipLock && !dryRun) {
    const locked = await acquireJobLock(lockOwner);
    if (!locked) {
      return {
        batchId,
        dryRun,
        skippedLock: true,
        processed: 0,
        success: 0,
        failed: 0,
        skipped: 0,
        items: [],
      };
    }
  }

  try {
    const userIds = options.userId
      ? [options.userId]
      : await getEnabledMitraUserIds();

    const enforceSchedule =
      executedBy === "system" && !dryRun && !options.force;

    const allCandidates: OverdueCustomerCandidate[] = [];
    for (const userId of userIds) {
      const settings = await getAutoIsolirSettings(userId);
      if (!options.userId && !settings?.enabled) continue;
      if (options.userId && !options.force && !settings?.enabled && !dryRun) {
        continue;
      }
      if (enforceSchedule && !isExecuteTimeDue(settings?.executeTime)) {
        continue;
      }
      const candidates = await getOverdueCustomers(userId, { settings });
      if (options.pelangganIdAllowList) {
        const allow = new Set(options.pelangganIdAllowList);
        allCandidates.push(
          ...candidates.filter((c) => allow.has(c.pelangganId))
        );
      } else {
        allCandidates.push(...candidates);
      }
    }

    const items: AutoIsolirRunItem[] = [];
    for (const candidate of allCandidates) {
      try {
        const item = await processCandidate(candidate, {
          dryRun,
          batchId,
          executedBy,
        });
        items.push(item);
      } catch (err) {
        logger.error({
          msg: "auto-isolir candidate error",
          pelangganId: candidate.pelangganId,
          error: err,
        });
        items.push({
          pelangganId: candidate.pelangganId,
          pelangganNama: candidate.pelangganNama,
          pppUsername: candidate.pppUsername,
          pembayaranId: candidate.pembayaranId,
          jatuh_tempo: candidate.jatuh_tempo,
          status: "failed",
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return {
      batchId,
      dryRun,
      processed: items.length,
      success: items.filter((i) => i.status === "success").length,
      failed: items.filter((i) => i.status === "failed").length,
      skipped: items.filter((i) => i.status === "skipped").length,
      items,
    };
  } finally {
    if (!options.skipLock && !dryRun) {
      await releaseJobLock(lockOwner);
    }
  }
}

/** Dry run: daftar pelanggan yang akan diisolir tanpa perubahan. */
export async function dryRunAutoIsolation(
  userId?: number,
  pelangganIdAllowList?: number[]
) {
  return runAutoIsolation({
    userId,
    dryRun: true,
    skipLock: true,
    force: true,
    executedBy: "dry-run",
    pelangganIdAllowList,
  });
}

/** Restore isolir setelah pembayaran lunas (jika setting aktif). */
export async function tryRestoreIsolirOnPayment(params: {
  pelangganId: number;
  pembayaranId: number;
  executedBy: string;
}): Promise<IsolirOperationResult | null> {
  const pel = await prisma.pelanggan.findUnique({
    where: { id: params.pelangganId },
    include: {
      ppp_secret: { include: { active_records: true } },
      router: {
        select: {
          id: true,
          userId: true,
          host: true,
          port: true,
          user: true,
          password: true,
          isolirProfileName: true,
          deleted: true,
        },
      },
    },
  });

  if (!pel?.ppp_secret || !pel.router || pel.router.deleted) return null;

  const mitraUserId = pel.router.userId;
  if (!mitraUserId) return null;

  const settings = await getAutoIsolirSettings(mitraUserId);
  if (settings && !settings.autoRestoreOnPayment) return null;

  const ppp = pel.ppp_secret;
  const router = pel.router;
  if (
    !isPppIsolir(ppp, { isolirProfileName: router.isolirProfileName }) &&
    !ppp.isIsolir
  ) {
    return null;
  }

  const op = await restoreCustomer({
    router: {
      id: router.id,
      host: router.host,
      port: router.port,
      user: router.user,
      password: router.password,
      isolirProfileName: router.isolirProfileName,
    },
    ppp,
  });

  await prisma.autoIsolirLog.create({
    data: {
      userId: mitraUserId,
      pelangganId: pel.id,
      pembayaranId: params.pembayaranId,
      pppUsername: ppp.name,
      routerId: router.id,
      oldProfile: op.oldProfile,
      newProfile: op.newProfile,
      action: "restore",
      status: op.ok ? (op.skipped ? "skipped" : "success") : "failed",
      errorMessage: op.error ?? op.skipReason,
      executedBy: params.executedBy,
      dryRun: false,
    },
  });

  return op;
}

export { getJakartaDateString };
