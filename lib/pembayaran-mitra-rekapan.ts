import prisma from "@/lib/prisma";
import { ppnNominalPerBaris } from "@/lib/pembayaran-tax";
import {
  mitraRekapanPembayaranWhere,
} from "@/lib/pembayaran-mitra-scope";
import {
  buildMitraRekapanRow,
  type PembayaranMitraRekapanRow,
} from "@/lib/pembayaran-mitra-calc";
import { isPaidRevenueBasis, normalizeRevenueBasis } from "@/lib/revenue-basis";
import { computeRegulatoryAmounts } from "@/lib/regulatory-calc";
import { getEffectiveRegulatorySettings } from "@/lib/regulatory-summary";
import {
  effectivePpnPercentFromPolicy,
  resolveMitraPpnPolicy,
} from "@/lib/ppn-policy";
import { Prisma, RevenueBasis, RoleName, StatusBayar } from "@prisma/client";

export type { PembayaranMitraRekapanRow } from "@/lib/pembayaran-mitra-calc";

export type PembayaranMitraUserRow = {
  id: number;
  nama: string;
  user: string;
  ppn: number | null;
  omset: number | null;
  role: RoleName;
  revenueBasis: RevenueBasis;
  revenueShareEnabled?: boolean;
};

export function bulanToDateRange(bulan: string) {
  const [year, month] = bulan.split("-").map(Number);
  const firstDate = new Date(year, month - 1, 1).toLocaleDateString("fr-CA");
  const lastDate = new Date(year, month, 0).toLocaleDateString("fr-CA");
  return { year, month, firstDate, lastDate };
}

type PembayaranGrossRow = {
  total: number;
  status: StatusBayar;
  paket: { harga: number };
};

function sumInvoiceTotals(rows: PembayaranGrossRow[]): number {
  return rows.reduce((acc, row) => acc + row.total, 0);
}

function filterRowsForBasis(
  rows: PembayaranGrossRow[],
  basis: RevenueBasis
): PembayaranGrossRow[] {
  if (!isPaidRevenueBasis(basis)) return rows;
  return rows.filter((row) => row.status === "Terbayar");
}

function sumPpnFromRows(
  rows: PembayaranGrossRow[],
  ppnPercent: number
): number {
  if (ppnPercent <= 0) return 0;
  return rows.reduce(
    (acc, val) =>
      acc + ppnNominalPerBaris(val.total, val.paket.harga, ppnPercent),
    0
  );
}

/** Total tagihan pelanggan mitra Admin per bulan (semua status). */
export async function computeMitraMonthlyInvoiceTotal(
  mitraUserId: number,
  year: number,
  month: number
): Promise<number> {
  return computeMitraMonthlyGrossTotal(
    mitraUserId,
    year,
    month,
    "INVOICE"
  );
}

/** Total bruto tagihan mitra per bulan sesuai metode bagi hasil. */
export async function computeMitraMonthlyGrossTotal(
  mitraUserId: number,
  year: number,
  month: number,
  basis: RevenueBasis
): Promise<number> {
  const { firstDate, lastDate } = bulanToDateRange(
    `${year}-${month.toString().padStart(2, "0")}`
  );
  const where = mitraRekapanPembayaranWhere(
    mitraUserId,
    firstDate,
    lastDate,
    isPaidRevenueBasis(basis) ? { status: "Terbayar" } : undefined
  );
  const agg = await prisma.pembayaran.aggregate({
    where,
    _sum: { total: true },
  });
  return agg._sum.total ?? 0;
}

async function fetchMitraMonthlyPembayaranRows(
  mitraUserId: number,
  firstDate: string,
  lastDate: string
) {
  return prisma.pembayaran.findMany({
    where: mitraRekapanPembayaranWhere(mitraUserId, firstDate, lastDate),
    select: {
      total: true,
      status: true,
      paket: { select: { harga: true } },
    },
  });
}

/** Filter user yang tampil di halaman /pembayaran/mitra. */
export const pembayaranMitraUserWhere: Prisma.UserWhereInput = {
  OR: [
    { role: "Client" },
    {
      role: "Admin",
      routers: { some: {} },
    },
  ],
};

async function computeMitraRegulatoryAmounts(
  user: PembayaranMitraUserRow,
  grossTotal: number
): Promise<{ bhp: number; uso: number }> {
  if (user.role !== "Admin" || grossTotal <= 0) {
    return { bhp: 0, uso: 0 };
  }
  const settings = await getEffectiveRegulatorySettings(user.id);
  const amounts = computeRegulatoryAmounts(grossTotal, settings);
  return { bhp: amounts.bhpAmount, uso: amounts.usoAmount };
}

export async function computePembayaranMitraRekapan(
  user: PembayaranMitraUserRow,
  firstDate: string,
  lastDate: string,
  year: number,
  month: number
): Promise<PembayaranMitraRekapanRow> {
  const ppnPolicy = await resolveMitraPpnPolicy(user.id);
  const ppnPercent = effectivePpnPercentFromPolicy(ppnPolicy);
  const revenueBasis = normalizeRevenueBasis(user.revenueBasis);

  if (user.role === "Client") {
    const ppnRate = ppnPercent / 100;
    const activeSubscriptions = await prisma.layanan.findMany({
      where: { tgl: { lte: lastDate } },
    });
    const filteredSubscriptions = activeSubscriptions.filter((subscription) => {
      const startDate = new Date(subscription.tgl);
      const endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + subscription.kontrak);
      return (
        startDate <= new Date(year, month, 0) &&
        endDate >= new Date(year, month - 1, 1)
      );
    });

    const calculation = filteredSubscriptions.reduce(
      (acc, val) => {
        let gross, vat;
        if (ppnPercent <= 0) {
          gross = val.bulanan;
          vat = 0;
        } else if (val.incVat) {
          gross = val.bulanan;
          const dpp = gross / (1 + ppnRate);
          vat = gross - dpp;
        } else {
          const dpp = val.bulanan;
          vat = dpp * ppnRate;
          gross = dpp + vat;
        }
        return { total: acc.total + gross, ppn: acc.ppn + vat };
      },
      { total: 0, ppn: 0 }
    );

    const total = Math.round(calculation.total);
    const ppn = Math.round(calculation.ppn);
    const { bhp, uso } = await computeMitraRegulatoryAmounts(user, total);
    const pembayaranMitraSum = await prisma.pembayaranMitra.aggregate({
      where: {
        tanggal: { gte: firstDate, lte: lastDate },
        userId: user.id,
      },
      _sum: { paid: true },
    });

    return buildMitraRekapanRow(
      total,
      ppn,
      bhp,
      uso,
      user.omset,
      pembayaranMitraSum._sum.paid || 0,
      {
        totalTagihan: total,
        revenueBasis,
        revenueShareEnabled: user.revenueShareEnabled !== false,
      }
    );
  }

  const allRows = await fetchMitraMonthlyPembayaranRows(
    user.id,
    firstDate,
    lastDate
  );
  const totalTagihan = sumInvoiceTotals(allRows);
  const rowsForSplit = filterRowsForBasis(allRows, revenueBasis);
  const total = sumInvoiceTotals(rowsForSplit);
  const ppn = sumPpnFromRows(rowsForSplit, ppnPercent);
  const { bhp, uso } = await computeMitraRegulatoryAmounts(user, total);
  const pembayaranMitraSum = await prisma.pembayaranMitra.aggregate({
    where: {
      tanggal: { gte: firstDate, lte: lastDate },
      userId: user.id,
    },
    _sum: { paid: true },
  });

  return buildMitraRekapanRow(
    total,
    ppn,
    bhp,
    uso,
    user.omset,
    pembayaranMitraSum._sum.paid || 0,
    {
      totalTagihan,
      revenueBasis,
      revenueShareEnabled: user.revenueShareEnabled !== false,
    }
  );
}

/** Agregat footer /pembayaran/mitra (Kantor Pusat, Terbayar, Belum). */
export function aggregatePembayaranMitraRekapan(
  rows: PembayaranMitraRekapanRow[]
) {
  let tagihanKantor = 0;
  let terbayar = 0;
  for (const row of rows) {
    tagihanKantor += row.tagihanKantor;
    terbayar += row.bayar;
  }
  return {
    total: tagihanKantor,
    terbayar,
    belum: tagihanKantor - terbayar,
    count: rows.length,
  };
}

/** Total kewajiban mitra → kantor pusat untuk satu bulan (hormati revenueBasis). */
export async function sumMitraTagihanKantorForBulan(
  bulan: string,
  filterUserId?: number
): Promise<number> {
  const { rows } = await listPembayaranMitraRekapan(bulan);
  const filtered = filterUserId
    ? rows.filter((r) => r.user.id === filterUserId)
    : rows;
  return filtered.reduce((acc, r) => acc + r.pembayaran.tagihanKantor, 0);
}

export async function listPembayaranMitraRekapan(bulan: string) {
  const { year, month, firstDate, lastDate } = bulanToDateRange(bulan);
  const users = await prisma.user.findMany({
    select: {
      id: true,
      nama: true,
      user: true,
      ppn: true,
      omset: true,
      role: true,
      revenueBasis: true,
      revenueShareEnabled: true,
    },
    where: pembayaranMitraUserWhere,
    orderBy: { nama: "asc" },
  });

  const rows = await Promise.all(
    users.map(async (userRow) => {
      const pembayaran = await computePembayaranMitraRekapan(
        userRow,
        firstDate,
        lastDate,
        year,
        month
      );
      return { user: userRow, pembayaran };
    })
  );

  return {
    rows,
    aggregate: aggregatePembayaranMitraRekapan(rows.map((r) => r.pembayaran)),
    firstDate,
    lastDate,
    year,
    month,
  };
}
