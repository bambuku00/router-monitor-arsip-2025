import { tagihanTotalFromPaket } from "@/lib/paket-persist";
import { getFirstBillingMonth } from "@/lib/billing-start";
import {
  billingMonthJatuhTempoDatesFromFirstToNow,
  billingPeriodFromJatuhTempo,
  jatuhTempoForBillingPeriod,
  monthJatuhTempoRange,
} from "@/lib/billing-due-date";
import { allocateNoInvoiceBatch } from "@/lib/pembayaran-no-invoice";
import prisma from "@/lib/prisma";
import { BillingStartMode, Prisma } from "@prisma/client";

export {
  billingPeriodFromJatuhTempo,
  jatuhTempoForBillingPeriod,
  monthJatuhTempoRange,
  billingMonthJatuhTempoDatesFromFirstToNow,
  billingMonthDatesFromFirstToNow,
  jatuhTempoFirstOfMonth,
} from "@/lib/billing-due-date";
export async function pelangganHasPembayaranInPeriod(
  pelangganId: number,
  period: string,
  db: Prisma.TransactionClient = prisma
): Promise<boolean> {
  const count = await db.pembayaran.count({
    where: {
      pelangganId,
      jatuh_tempo: monthJatuhTempoRange(period),
    },
  });
  return count > 0;
}

async function occupiedBillingPeriodsForPelanggan(
  pelangganId: number,
  db: Prisma.TransactionClient
): Promise<Set<string>> {
  const rows = await db.pembayaran.findMany({
    where: { pelangganId },
    select: { jatuh_tempo: true },
  });
  return new Set(rows.map((r) => billingPeriodFromJatuhTempo(r.jatuh_tempo)));
}

async function skippedBillingPeriodsForPelanggan(
  pelangganId: number,
  db: Prisma.TransactionClient
): Promise<Set<string>> {
  const rows = await db.tagihanDihapus.findMany({
    where: { pelangganId },
    select: { period: true },
  });
  return new Set(rows.map((r) => r.period));
}

/** Bulan yang belum punya tagihan dan tidak ditandai dihapus Superadmin. */
export function selectBillingPeriodsToCreate(
  monthDates: string[],
  occupied: Set<string>,
  skipped: Set<string>
): string[] {
  const seen = new Set<string>();
  const toCreate: string[] = [];
  for (const raw of monthDates) {
    const period = billingPeriodFromJatuhTempo(raw);
    if (occupied.has(period) || skipped.has(period) || seen.has(period)) continue;
    seen.add(period);
    toCreate.push(jatuhTempoForBillingPeriod(period));
  }
  return toCreate;
}

/** Catat periode tagihan yang dihapus supaya simpan PPP / generate tidak membuat ulang. */
export async function rememberDeletedTagihanPeriods(
  tx: Prisma.TransactionClient,
  pelangganId: number,
  jatuhTempos: string[]
): Promise<void> {
  const periods = [
    ...new Set(jatuhTempos.map((value) => billingPeriodFromJatuhTempo(value))),
  ].filter((period) => period.length === 7);
  if (periods.length === 0) return;
  await tx.tagihanDihapus.createMany({
    data: periods.map((period) => ({ pelangganId, period })),
    skipDuplicates: true,
  });
}

/**
 * Backfill tagihan dari bulan pertama eligible sampai bulan berjalan.
 * Lewati bulan yang sudah punya tagihan (tanggal jatuh tempo apa pun).
 */
export async function createBackfillPembayaranForPelanggan(
  params: {
    pelangganId: number;
    paketId: number;
    tgl: string;
    inputterId?: number;
    ppnRate: number;
    billingStartMode: BillingStartMode | null;
    billingStartDate: Date | null;
    ownedByIsp?: boolean;
  },
  db: Prisma.TransactionClient = prisma
): Promise<number> {
  const paket = await db.paket.findUnique({
    where: { id: params.paketId },
    select: { id: true, harga: true, nominalPembayaran: true },
  });
  if (!paket) return 0;

  const firstMonth = getFirstBillingMonth({
    tgl: params.tgl,
    billingStartMode: params.billingStartMode ?? "NEXT_MONTH",
    billingStartDate: params.billingStartDate,
    ownedByIsp: params.ownedByIsp === true,
  });
  const monthDates = billingMonthJatuhTempoDatesFromFirstToNow(firstMonth);
  if (monthDates.length === 0) return 0;

  const occupied = await occupiedBillingPeriodsForPelanggan(
    params.pelangganId,
    db
  );
  const skipped = await skippedBillingPeriodsForPelanggan(
    params.pelangganId,
    db
  );
  const toCreate = selectBillingPeriodsToCreate(monthDates, occupied, skipped);

  if (toCreate.length === 0) return 0;

  const total = tagihanTotalFromPaket(paket, params.ppnRate * 100);

  const persist = async (tx: Prisma.TransactionClient) => {
    const noInvoices = await allocateNoInvoiceBatch(toCreate.length, tx);
    const result = await tx.pembayaran.createMany({
      data: toCreate.map((jatuh_tempo, index) => ({
        ...(params.inputterId != null ? { inputterId: params.inputterId } : {}),
        pelangganId: params.pelangganId,
        paketId: paket.id,
        jatuh_tempo,
        total,
        noInvoice: noInvoices[index]!,
      })),
      skipDuplicates: true,
    });
    return result.count;
  };

  // Jika sudah di dalam transaksi pemanggil, jangan nest $transaction.
  if (db === prisma) {
    return prisma.$transaction((tx) => persist(tx), {
      maxWait: 15_000,
      timeout: 60_000,
    });
  }
  return persist(db);
}
