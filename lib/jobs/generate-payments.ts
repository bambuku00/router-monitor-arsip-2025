import { tagihanTotalFromPaket } from "@/lib/paket-persist";
import { isPelangganEligibleForBillingPeriod } from "@/lib/billing-start";
import { monthJatuhTempoRange } from "@/lib/billing-due-date";
import {
  getBillContextForPeriod,
  getJakartaBillContext,
  getOrCreateAppSettings,
  resolveMitraGenerateDay,
  type JakartaBillContext,
} from "@/lib/billing-generate-config";
import { pelangganUntukPenagihanWhere } from "@/lib/pembayaran-pelanggan-scope";
import { isPppIsolir } from "@/lib/ppp-isolir";
import { dedupePelangganForMitraRouters } from "@/lib/pembayaran-dedupe-pelanggan";
import { dedupeTagihanDuplikatForMitraRouters } from "@/lib/pembayaran-dedupe-tagihan";
import { allocateNoInvoiceBatch } from "@/lib/pembayaran-no-invoice";
import { pelangganHasPembayaranInPeriod } from "@/lib/pembayaran-backfill";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { BillingGenerateLogStatus, Prisma } from "@prisma/client";

const BATCH_SIZE = 200;

export type MitraGenerateResult = {
  mitraUserId: number;
  mitraNama: string;
  status: BillingGenerateLogStatus;
  jmlh: number;
  message?: string;
};

export type GeneratePaymentsJobResult = {
  jmlh: number;
  bulan: string;
  period: string;
  mitraResults: MitraGenerateResult[];
};

export type ScheduledBillingGenerateResult = {
  skippedSchedule: boolean;
  period: string;
  day: number;
  hour: number;
  processed: MitraGenerateResult[];
};

type MitraWithRouters = Prisma.UserGetPayload<{
  include: {
    routers: {
      include: {
        pelanggan: {
          include: {
            paket: true;
            ppp_secret: { include: { active_records: true } };
          };
        };
      };
    };
  };
}>;

type CreateInvoice = {
  jatuh_tempo: string;
  total: number;
  pelangganId: number;
  paketId: number;
  nonaktif: boolean;
};

async function countMitraPembayaranInPeriod(
  mitraUserId: number,
  ctx: JakartaBillContext
): Promise<number> {
  const routerIds = (
    await prisma.router.findMany({
      where: { userId: mitraUserId },
      select: { id: true },
    })
  ).map((r) => r.id);
  if (routerIds.length === 0) return 0;
  return prisma.pembayaran.count({
    where: {
      jatuh_tempo: monthJatuhTempoRange(ctx.period),
      pelanggan: { routerId: { in: routerIds } },
    },
  });
}

async function shouldSkipGenerateForPeriod(
  mitraUserId: number,
  mitraNama: string,
  ctx: JakartaBillContext
): Promise<MitraGenerateResult | null> {
  const existingLog = await prisma.billingGenerateLog.findUnique({
    where: { userId_period: { userId: mitraUserId, period: ctx.period } },
  });
  if (!existingLog) return null;

  const actualCount = await countMitraPembayaranInPeriod(mitraUserId, ctx);
  if (actualCount > 0) {
    return {
      mitraUserId,
      mitraNama,
      status: BillingGenerateLogStatus.skipped,
      jmlh: actualCount,
      message: "Sudah digenerate untuk periode ini",
    };
  }

  await prisma.billingGenerateLog.delete({
    where: { userId_period: { userId: mitraUserId, period: ctx.period } },
  });
  return null;
}

async function claimGenerateLogForPeriod(
  mitraUserId: number,
  ctx: JakartaBillContext
): Promise<boolean> {
  let claimed = await claimGenerateLog(mitraUserId, ctx.period);
  if (claimed) return true;

  await prisma.billingGenerateLog
    .delete({
      where: { userId_period: { userId: mitraUserId, period: ctx.period } },
    })
    .catch(() => undefined);

  claimed = await claimGenerateLog(mitraUserId, ctx.period);
  return claimed;
}

async function loadMitra(userId: number): Promise<MitraWithRouters | null> {
  return prisma.user.findFirst({
    where: { id: userId, role: "Admin", parentId: null },
    include: {
      routers: {
        where: { deleted: false },
        include: {
          pelanggan: {
            where: {
              stop: false,
              ...pelangganUntukPenagihanWhere,
              ppp_secret: { isNot: null },
            },
            include: {
              paket: true,
              ppp_secret: { include: { active_records: true } },
            },
          },
        },
      },
    },
  });
}

async function buildInvoicesForMitra(
  user: MitraWithRouters,
  ctx: JakartaBillContext,
  existingPelangganIds: Set<number>
): Promise<CreateInvoice[]> {
  const mode = user.billingStartMode ?? "NEXT_MONTH";
  const customDate = user.billingStartDate;

  const invoices: CreateInvoice[] = [];
  const seenPerRouter = new Set<string>();

  for (const router of user.routers) {
    for (const pelanggan of router.pelanggan) {
      if (pelanggan.ppp_secretId == null || !pelanggan.ppp_secret?.name?.trim()) {
        continue;
      }
      if (
        isPppIsolir(pelanggan.ppp_secret, {
          isolirProfileName: router.isolirProfileName,
        })
      ) {
        continue;
      }

      const dedupeKey = `${router.id}::${pelanggan.ppp_secret.name.trim().toLowerCase()}`;
      if (seenPerRouter.has(dedupeKey)) continue;
      seenPerRouter.add(dedupeKey);

      const paket = pelanggan.paket;
      if (paket == null || pelanggan.paketId == null) continue;

      const hargaDpp = Math.round(Number(paket.harga));
      if (hargaDpp <= 0 && (paket.nominalPembayaran ?? 0) <= 0) continue;

      const eligible = isPelangganEligibleForBillingPeriod({
        tgl: pelanggan.tgl,
        period: ctx.period,
        billingStartMode: mode,
        billingStartDate: customDate,
        ownedByIsp: user.ownedByIsp === true,
      });
      if (!eligible) continue;
      if (existingPelangganIds.has(pelanggan.id)) continue;

      invoices.push({
        jatuh_tempo: ctx.tanggalStr,
        total: tagihanTotalFromPaket(paket, user.ppn ?? 11),
        pelangganId: pelanggan.id,
        paketId: pelanggan.paketId,
        nonaktif: pelanggan.stop,
      });
    }
  }

  return invoices;
}

async function persistInvoices(invoices: CreateInvoice[]): Promise<number> {
  let totalProcessed = 0;
  for (let i = 0; i < invoices.length; i += BATCH_SIZE) {
    const batch = invoices.slice(i, i + BATCH_SIZE);
    // Alokasi + insert dalam satu transaksi agar nomor tidak "dicuri" request lain
    // (double-click / cron bersamaan) sebelum createMany.
    const created = await prisma.$transaction(
      async (tx) => {
        const noInvoices = await allocateNoInvoiceBatch(batch.length, tx);
        const result = await tx.pembayaran.createMany({
          data: batch.map((row, index) => ({
            ...row,
            noInvoice: noInvoices[index]!,
          })),
          skipDuplicates: true,
        });
        return result.count;
      },
      { maxWait: 15_000, timeout: 60_000 }
    );
    totalProcessed += created;
    logger.info({
      msg: "Generate Tagihan batch",
      batch: Math.floor(i / BATCH_SIZE) + 1,
      processed: totalProcessed,
      total: invoices.length,
      created,
    });
  }
  return totalProcessed;
}

async function claimGenerateLog(
  mitraUserId: number,
  period: string
): Promise<boolean> {
  try {
    await prisma.billingGenerateLog.create({
      data: {
        userId: mitraUserId,
        period,
        status: BillingGenerateLogStatus.success,
        invoiceCount: 0,
        message: "processing",
      },
    });
    return true;
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return false;
    }
    throw err;
  }
}

async function finalizeGenerateLog(
  mitraUserId: number,
  period: string,
  data: {
    status: BillingGenerateLogStatus;
    invoiceCount: number;
    message?: string;
  }
) {
  await prisma.billingGenerateLog.update({
    where: {
      userId_period: { userId: mitraUserId, period },
    },
    data: {
      status: data.status,
      invoiceCount: data.invoiceCount,
      message: data.message ?? null,
    },
  });
}

export async function generatePaymentsForMitra(
  mitraUserId: number,
  options: { skipLogCheck?: boolean; ctx?: JakartaBillContext } = {}
): Promise<MitraGenerateResult> {
  const ctx = options.ctx ?? getJakartaBillContext();

  const mitraMeta = await prisma.user.findFirst({
    where: { id: mitraUserId, role: "Admin", parentId: null },
    select: { nama: true },
  });
  if (!mitraMeta) {
    return {
      mitraUserId,
      mitraNama: `#${mitraUserId}`,
      status: BillingGenerateLogStatus.failed,
      jmlh: 0,
      message: "Mitra tidak ditemukan",
    };
  }

  if (!options.skipLogCheck) {
    const skip = await shouldSkipGenerateForPeriod(
      mitraUserId,
      mitraMeta.nama,
      ctx
    );
    if (skip) return skip;
  }

  const claimed = await claimGenerateLogForPeriod(mitraUserId, ctx);
  if (!claimed) {
    const actualCount = await countMitraPembayaranInPeriod(mitraUserId, ctx);
    return {
      mitraUserId,
      mitraNama: mitraMeta.nama,
      status: BillingGenerateLogStatus.skipped,
      jmlh: actualCount,
      message: "Sudah digenerate untuk periode ini",
    };
  }

  const routerIds = (
    await prisma.router.findMany({
      where: { userId: mitraUserId, deleted: false },
      select: { id: true },
    })
  ).map((r) => r.id);

  try {
    let deduped = 0;
    let tagihanDeduped = 0;
    await prisma.$transaction(async (tx) => {
      deduped = await dedupePelangganForMitraRouters(routerIds, tx);
      tagihanDeduped = await dedupeTagihanDuplikatForMitraRouters(
        routerIds,
        { bulan: ctx.period },
        tx
      );
    });

    const user = await loadMitra(mitraUserId);
    if (!user) {
      return {
        mitraUserId,
        mitraNama: mitraMeta.nama,
        status: BillingGenerateLogStatus.failed,
        jmlh: 0,
        message: "Mitra tidak ditemukan",
      };
    }

    const existingInvoices = await prisma.pembayaran.findMany({
      where: {
        jatuh_tempo: monthJatuhTempoRange(ctx.period),
        paket: { userId: mitraUserId },
      },
      select: { pelangganId: true },
    });
    const existingPelangganIds = new Set(
      existingInvoices.map((inv) => inv.pelangganId)
    );
    const skippedInvoices = await prisma.tagihanDihapus.findMany({
      where: {
        period: ctx.period,
        pelanggan: { router: { userId: mitraUserId } },
      },
      select: { pelangganId: true },
    });
    for (const row of skippedInvoices) {
      existingPelangganIds.add(row.pelangganId);
    }

    const invoices = await buildInvoicesForMitra(
      user,
      ctx,
      existingPelangganIds
    );
    const jmlh = await persistInvoices(invoices);

    const dedupeParts: string[] = [];
    if (deduped > 0) {
      dedupeParts.push(`${deduped} pelanggan duplikat/yatim dihapus`);
    }
    if (tagihanDeduped > 0) {
      dedupeParts.push(`${tagihanDeduped} tagihan duplikat dihapus`);
    }
    const dedupeNote =
      dedupeParts.length > 0 ? `; ${dedupeParts.join(", ")}` : "";
    const invoiceNote =
      jmlh > 0
        ? `${jmlh} tagihan dibuat`
        : "Tidak ada tagihan baru (cek paket harga > 0 & PPP terhubung)";

    await finalizeGenerateLog(mitraUserId, ctx.period, {
      status: BillingGenerateLogStatus.success,
      invoiceCount: jmlh,
      message: `${invoiceNote}${dedupeNote}`,
    });

    return {
      mitraUserId,
      mitraNama: mitraMeta.nama,
      status: BillingGenerateLogStatus.success,
      jmlh,
      message: `${invoiceNote}${dedupeNote}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await finalizeGenerateLog(mitraUserId, ctx.period, {
      status: BillingGenerateLogStatus.failed,
      invoiceCount: 0,
      message,
    }).catch(() => undefined);
    logger.error({
      msg: "Generate tagihan mitra error",
      mitraUserId,
      error: err,
    });
    return {
      mitraUserId,
      mitraNama: mitraMeta.nama,
      status: BillingGenerateLogStatus.failed,
      jmlh: 0,
      message,
    };
  }
}

/** Cron harian: hanya mitra yang jadwalnya cocok hari & jam Jakarta. */
export async function runScheduledBillingGenerate(): Promise<ScheduledBillingGenerateResult> {
  const ctx = getJakartaBillContext();
  const settings = await getOrCreateAppSettings();

  if (ctx.hour !== settings.billingGenerateHour) {
    return {
      skippedSchedule: true,
      period: ctx.period,
      day: ctx.day,
      hour: ctx.hour,
      processed: [],
    };
  }

  const mitras = await prisma.user.findMany({
    where: { role: "Admin", parentId: null },
    select: { id: true, nama: true, billingGenerateDay: true },
  });

  const dueMitras = mitras.filter(
    (m) => resolveMitraGenerateDay(m.billingGenerateDay, settings.billingGenerateDay) === ctx.day
  );

  const processed: MitraGenerateResult[] = [];
  for (const mitra of dueMitras) {
    processed.push(await generatePaymentsForMitra(mitra.id, { ctx }));
  }

  logger.info({
    msg: "Scheduled billing generate",
    period: ctx.period,
    day: ctx.day,
    hour: ctx.hour,
    dueCount: dueMitras.length,
    processed,
  });

  return {
    skippedSchedule: false,
    period: ctx.period,
    day: ctx.day,
    hour: ctx.hour,
    processed,
  };
}

/** Manual Superadmin: semua mitra, abaikan jadwal, tetap cek log duplikat. */
export async function runManualBillingGenerateAll(): Promise<GeneratePaymentsJobResult> {
  const ctx = getJakartaBillContext();
  const mitras = await prisma.user.findMany({
    where: { role: "Admin", parentId: null },
    select: { id: true },
  });

  const mitraResults: MitraGenerateResult[] = [];
  for (const mitra of mitras) {
    mitraResults.push(await generatePaymentsForMitra(mitra.id, { ctx }));
  }

  const jmlh = mitraResults.reduce((acc, r) => acc + r.jmlh, 0);
  const billingDate = new Date(ctx.year, ctx.month - 1, 1);
  const result: GeneratePaymentsJobResult = {
    jmlh,
    period: ctx.period,
    bulan: new Intl.DateTimeFormat("id-ID", { month: "short" }).format(
      billingDate
    ),
    mitraResults,
  };

  logger.info({ msg: "Manual billing generate selesai", result });
  return result;
}

export type CreatePelangganTagihanResult = {
  created: boolean;
  period: string;
  jatuh_tempo: string;
};

/**
 * Buat satu tagihan untuk pelanggan + periode jika belum ada.
 * Menggunakan perhitungan yang sama dengan batch Generate Tagihan (buildInvoicesForMitra).
 * Tidak menulis BillingGenerateLog — hanya untuk pemanggil khusus (mis. rekonsiliasi sync PPP).
 */
export async function createTagihanForPelangganIfMissing(params: {
  pelangganId: number;
  mitraUserId: number;
  ctx?: JakartaBillContext;
}): Promise<CreatePelangganTagihanResult> {
  const ctx = params.ctx ?? getJakartaBillContext();

  const pelanggan = await prisma.pelanggan.findUnique({
    where: { id: params.pelangganId },
    include: {
      paket: true,
      router: { select: { isolirProfileName: true } },
      ppp_secret: {
        select: {
          name: true,
          profile: true,
          isIsolir: true,
          disabled: true,
        },
      },
    },
  });

  const empty = {
    created: false,
    period: ctx.period,
    jatuh_tempo: ctx.tanggalStr,
  };

  if (!pelanggan) return empty;
  if (pelanggan.ppp_secretId == null || !pelanggan.ppp_secret?.name?.trim()) {
    return empty;
  }
  if (
    isPppIsolir(pelanggan.ppp_secret, {
      isolirProfileName: pelanggan.router?.isolirProfileName,
    })
  ) {
    return empty;
  }

  const mitra = await prisma.user.findFirst({
    where: { id: params.mitraUserId, role: "Admin", parentId: null },
    select: { ppn: true, billingStartMode: true, billingStartDate: true, ownedByIsp: true },
  });
  if (!mitra) return empty;

  const paket = pelanggan.paket;
  if (paket == null || pelanggan.paketId == null) return empty;

  const hargaDpp = Math.round(Number(paket.harga));
  if (hargaDpp <= 0 && (paket.nominalPembayaran ?? 0) <= 0) return empty;

  const eligible = isPelangganEligibleForBillingPeriod({
    tgl: pelanggan.tgl,
    period: ctx.period,
    billingStartMode: mitra.billingStartMode ?? "NEXT_MONTH",
    billingStartDate: mitra.billingStartDate,
    ownedByIsp: mitra.ownedByIsp === true,
  });
  if (!eligible) return empty;

  if (await pelangganHasPembayaranInPeriod(pelanggan.id, ctx.period)) {
    return empty;
  }

  const invoice: CreateInvoice = {
    jatuh_tempo: ctx.tanggalStr,
    total: tagihanTotalFromPaket(paket, mitra.ppn ?? 11),
    pelangganId: pelanggan.id,
    paketId: pelanggan.paketId,
    nonaktif: false,
  };

  const created = await persistInvoices([invoice]);
  return {
    created: created > 0,
    period: ctx.period,
    jatuh_tempo: ctx.tanggalStr,
  };
}

/**
 * Setelah buka isolir: buat tagihan periode berjalan bila belum ada agar pelanggan
 * tetap muncul di halaman pembayaran (selaras rekonsiliasi berhenti → langganan).
 */
export async function ensureTagihanAfterRestoreIsolir(params: {
  routerId: number;
  pppName: string;
  ctx?: JakartaBillContext;
}): Promise<CreatePelangganTagihanResult> {
  const ctx = params.ctx ?? getJakartaBillContext();
  const empty: CreatePelangganTagihanResult = {
    created: false,
    period: ctx.period,
    jatuh_tempo: ctx.tanggalStr,
  };

  const pelanggan = await prisma.pelanggan.findFirst({
    where: {
      stop: false,
      ppp_secret: {
        is: { routerId: params.routerId, name: params.pppName },
      },
    },
    select: {
      id: true,
      router: { select: { userId: true } },
    },
  });

  if (!pelanggan?.router?.userId) return empty;

  return createTagihanForPelangganIfMissing({
    pelangganId: pelanggan.id,
    mitraUserId: pelanggan.router.userId,
    ctx,
  });
}

/** @deprecated Gunakan runManualBillingGenerateAll atau runScheduledBillingGenerate */
export async function runGeneratePaymentsJob(): Promise<GeneratePaymentsJobResult> {
  return runManualBillingGenerateAll();
}
