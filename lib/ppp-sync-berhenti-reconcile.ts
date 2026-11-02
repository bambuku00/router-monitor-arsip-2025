import { getJakartaBillContext } from "@/lib/billing-generate-config";
import { createTagihanForPelangganIfMissing } from "@/lib/jobs/generate-payments";
import { isMikrotikPppSecretActive } from "@/lib/mikrotik-ppp-secret-active";
import prisma from "@/lib/prisma";
import type { PPPSecret } from "@/lib/router-types";
import { logActivityEvent } from "@/lib/activity-audit-log";
import { recordPelangganStatusLog } from "@/lib/pelanggan-status-log";

export type PppSyncBerhentiReconcileResult = {
  reactivated: number;
  tagihanCreated: number;
};

export type PppSyncBerhentiReconcileParams = {
  routerId: number;
  mitraUserId: number;
  mikrotikSecrets: PPPSecret[];
  actor?: { userId?: number; username?: string };
};

function formatBerhentiReconcileActivityLog(params: {
  pelangganNama: string;
  tagihanCreated: boolean;
}): string {
  const tagihanLine = params.tagihanCreated
    ? "Dibuat otomatis untuk periode berjalan."
    : "Tagihan sudah ada, tidak dibuat ulang.";

  return [
    "SYSTEM",
    "",
    "Sinkronisasi PPPoE",
    "",
    `Pelanggan : ${params.pelangganNama}`,
    "",
    "Status sebelumnya :",
    "Berhenti",
    "",
    "Status MikroTik :",
    "PPPoE Secret masih aktif",
    "",
    "Aksi :",
    "Status dikembalikan menjadi Langganan.",
    "",
    "Tagihan :",
    tagihanLine,
  ].join("\n");
}

/**
 * Setelah sync PPPoE: jika pelanggan Berhenti di website tetapi secret masih aktif
 * di MikroTik, kembalikan ke Langganan dan buat tagihan periode berjalan bila perlu.
 */
export async function reconcileBerhentiPelangganAfterPppSync(
  params: PppSyncBerhentiReconcileParams
): Promise<PppSyncBerhentiReconcileResult> {
  const ctx = getJakartaBillContext();
  const activeSecretNames = new Set(
    params.mikrotikSecrets
      .filter(isMikrotikPppSecretActive)
      .map((secret) => secret.name)
  );

  if (activeSecretNames.size === 0) {
    return { reactivated: 0, tagihanCreated: 0 };
  }

  const stoppedPelanggan = await prisma.pelanggan.findMany({
    where: {
      routerId: params.routerId,
      stop: true,
      ppp_secretId: { not: null },
      ppp_secret: { isNot: null },
    },
    include: {
      ppp_secret: { select: { name: true } },
    },
  });

  let reactivated = 0;
  let tagihanCreated = 0;

  for (const pelanggan of stoppedPelanggan) {
    const secretName = pelanggan.ppp_secret?.name?.trim();
    if (!secretName || !activeSecretNames.has(secretName)) continue;

    await prisma.pelanggan.update({
      where: { id: pelanggan.id },
      data: { stop: false, tgl_stop: null },
    });
    try {
      await recordPelangganStatusLog({
        pelangganId: pelanggan.id,
        action: "resume",
        actor: "system",
      });
    } catch {
      // Catatan tidak boleh menggagalkan sinkron.
    }

    const tagihan = await createTagihanForPelangganIfMissing({
      pelangganId: pelanggan.id,
      mitraUserId: params.mitraUserId,
      ctx,
    });

    logActivityEvent({
      action: "ppp_sync_berhenti_reconcile",
      outcome: "success",
      userId: params.actor?.userId,
      username: params.actor?.username ?? "SYSTEM",
      reason: formatBerhentiReconcileActivityLog({
        pelangganNama: pelanggan.nama,
        tagihanCreated: tagihan.created,
      }),
      meta: {
        routerId: params.routerId,
        pelangganId: pelanggan.id,
        pelangganNama: pelanggan.nama,
        pppSecretName: secretName,
        period: ctx.period,
        jatuh_tempo: tagihan.jatuh_tempo,
        tagihanCreated: tagihan.created,
      },
    });

    reactivated += 1;
    if (tagihan.created) tagihanCreated += 1;
  }

  return { reactivated, tagihanCreated };
}
