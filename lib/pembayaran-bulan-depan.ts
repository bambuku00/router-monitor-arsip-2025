import {
  billingPeriodFromJatuhTempo,
  formatBillingPeriodLabel,
  jatuhTempoForBillingPeriod,
  prepaidBillingPeriods,
} from "@/lib/billing-due-date";
import { allocateNoInvoiceBatch } from "@/lib/pembayaran-no-invoice";
import { MetodeBayar, Prisma, StatusBayar } from "@prisma/client";

type PayAheadSource = {
  id: number;
  pelangganId: number;
  paketId: number;
  jatuh_tempo: string;
  total: number;
};

export type PembayaranLunasClaim = {
  id: number;
  pelangganId: number;
  total: number;
  /** Log lunas yang baru ditulis. Null bila tagihan sudah lunas sebelum klaim ini. */
  logBayarId: number | null;
};

/**
 * Tandai satu tagihan lunas hanya bila status masih Belum.
 * `updateMany` dengan `status: Belum` adalah satu pernyataan UPDATE.
 * Di InnoDB permintaan kedua menunggu kunci baris, lalu tidak mengubah apa pun
 * dan tidak menulis LogBayar. Nominal tagihan tidak diubah.
 */
export async function claimPembayaranLunas(
  tx: Prisma.TransactionClient,
  params: {
    pembayaranId: number;
    metode: MetodeBayar | null;
    bankId: number | null;
    inputterId: number;
    bayarSekaligus?: number | null;
  }
): Promise<PembayaranLunasClaim | null> {
  const claimed = await tx.pembayaran.updateMany({
    where: { id: params.pembayaranId, status: StatusBayar.Belum },
    data: {
      status: StatusBayar.Terbayar,
      bankId: params.bankId,
      metode: params.metode,
      inputterId: params.inputterId,
      ...(params.bayarSekaligus != null && params.bayarSekaligus > 1
        ? { bayarSekaligus: params.bayarSekaligus }
        : {}),
    },
  });
  if (claimed.count !== 1) return null;

  const updated = await tx.pembayaran.findUnique({
    where: { id: params.pembayaranId },
    select: { id: true, pelangganId: true, total: true, status: true },
  });
  if (!updated || updated.status !== StatusBayar.Terbayar) return null;

  const log = await tx.logBayar.create({
    data: {
      pembayaranId: updated.id,
      inputterId: params.inputterId,
      status: StatusBayar.Terbayar,
      metode: params.metode,
      total: updated.total,
    },
    select: { id: true },
  });

  return {
    id: updated.id,
    pelangganId: updated.pelangganId,
    total: updated.total,
    logBayarId: log.id,
  };
}

function isUniqueConflict(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
  );
}

/** Buat tagihan bulan depan yang belum ada. Jika permintaan lain sudah membuatnya, klaim hanya bila masih Belum. */
async function createPrepaidPembayaran(
  tx: Prisma.TransactionClient,
  data: {
    noInvoice: string;
    pelangganId: number;
    paketId: number;
    jatuh_tempo: string;
    total: number;
    metode: MetodeBayar;
    bankId: number | null;
    inputterId: number;
    bayarSekaligus?: number | null;
  }
): Promise<PembayaranLunasClaim | null> {
  try {
    const created = await tx.pembayaran.create({
      data: {
        noInvoice: data.noInvoice,
        pelangganId: data.pelangganId,
        paketId: data.paketId,
        jatuh_tempo: data.jatuh_tempo,
        total: data.total,
        status: StatusBayar.Terbayar,
        bankId: data.bankId,
        metode: data.metode,
        inputterId: data.inputterId,
        ...(data.bayarSekaligus != null && data.bayarSekaligus > 1
          ? { bayarSekaligus: data.bayarSekaligus }
          : {}),
      },
      select: { id: true, pelangganId: true, total: true },
    });
    const log = await tx.logBayar.create({
      data: {
        pembayaranId: created.id,
        inputterId: data.inputterId,
        status: StatusBayar.Terbayar,
        metode: data.metode,
        total: created.total,
      },
      select: { id: true },
    });
    return { ...created, logBayarId: log.id };
  } catch (err) {
    if (!isUniqueConflict(err)) throw err;
    const raced = await tx.pembayaran.findFirst({
      where: {
        pelangganId: data.pelangganId,
        jatuh_tempo: data.jatuh_tempo,
      },
      select: { id: true, status: true },
    });
    if (!raced) throw err;
    if (raced.status === StatusBayar.Terbayar) return null;
    return claimPembayaranLunas(tx, {
      pembayaranId: raced.id,
      metode: data.metode,
      bankId: data.bankId,
      inputterId: data.inputterId,
      bayarSekaligus: data.bayarSekaligus,
    });
  }
}

/** Lunasi bulan tagihan ini dan bulan berikutnya. Tagihan yang belum ada dibuat langsung Terbayar. */
export async function payPelangganMonthsAhead(
  tx: Prisma.TransactionClient,
  params: {
    source: PayAheadSource;
    bulanBayar: number;
    metode: "Transfer" | "Cash";
    bankId: number | null;
    inputterId: number;
  }
) {
  const periods = prepaidBillingPeriods(
    params.source.jatuh_tempo,
    params.bulanBayar
  );
  const rows = await tx.pembayaran.findMany({
    where: { pelangganId: params.source.pelangganId },
    select: { id: true, jatuh_tempo: true, status: true, total: true },
  });
  const byPeriod = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const period = billingPeriodFromJatuhTempo(row.jatuh_tempo);
    const current = byPeriod.get(period);
    if (!current || row.id === params.source.id) byPeriod.set(period, row);
  }

  const missing = periods.filter((period) => !byPeriod.has(period));
  const noInvoices =
    missing.length > 0 ? await allocateNoInvoiceBatch(missing.length, tx) : [];

  let primary: PembayaranLunasClaim | null = null;
  let newlyPaid = 0;
  const claimedRows: PembayaranLunasClaim[] = [];
  const sekaligus = params.bulanBayar > 1 ? params.bulanBayar : null;

  const rememberSource = (row: PembayaranLunasClaim) => {
    if (row.id === params.source.id) primary = row;
  };

  for (const period of periods) {
    const existing = byPeriod.get(period);
    if (existing) {
      if (existing.status === StatusBayar.Terbayar) {
        if (existing.id === params.source.id) {
          primary = {
            id: existing.id,
            pelangganId: params.source.pelangganId,
            total: existing.total,
            logBayarId: null,
          };
        }
        continue;
      }
      const claimed = await claimPembayaranLunas(tx, {
        pembayaranId: existing.id,
        metode: params.metode,
        bankId: params.bankId,
        inputterId: params.inputterId,
        bayarSekaligus: sekaligus,
      });
      if (claimed) {
        newlyPaid += 1;
        claimedRows.push(claimed);
        rememberSource(claimed);
      } else if (existing.id === params.source.id) {
        primary = {
          id: existing.id,
          pelangganId: params.source.pelangganId,
          total: existing.total,
          logBayarId: null,
        };
      }
      continue;
    }

    const created = await createPrepaidPembayaran(tx, {
      noInvoice: noInvoices[missing.indexOf(period)]!,
      pelangganId: params.source.pelangganId,
      paketId: params.source.paketId,
      jatuh_tempo: jatuhTempoForBillingPeriod(period),
      total: params.source.total,
      metode: params.metode,
      bankId: params.bankId,
      inputterId: params.inputterId,
      bayarSekaligus: sekaligus,
    });
    if (!created) continue;
    newlyPaid += 1;
    claimedRows.push(created);
    const sourcePeriod = billingPeriodFromJatuhTempo(params.source.jatuh_tempo);
    if (period === sourcePeriod) primary = created;
  }

  const labels = periods.map(formatBillingPeriodLabel).join(", ");
  return {
    primary,
    newlyPaid,
    claimed: claimedRows,
    message: `${periods.length} bulan ditandai lunas: ${labels}`,
  };
}
