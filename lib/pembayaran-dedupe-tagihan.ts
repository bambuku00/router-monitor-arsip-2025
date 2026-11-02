import {
  billingPeriodFromJatuhTempo,
  monthJatuhTempoRange,
} from "@/lib/billing-due-date";
import prisma from "@/lib/prisma";
import { MetodeBayar, Prisma, StatusBayar } from "@prisma/client";

type PembayaranLite = {
  id: number;
  pelangganId: number;
  jatuh_tempo: string;
  status: StatusBayar;
  inputterId: number | null;
  metode: MetodeBayar | null;
};

/** Skor lebih tinggi = tagihan yang dipertahankan. */
function keeperScore(p: PembayaranLite): number {
  let score = 0;
  if (p.status === StatusBayar.Terbayar) score += 1000;
  if (p.inputterId != null) score += 100;
  if (p.metode) score += 10;
  return score * 1_000_000 + p.id;
}

/**
 * Hapus tagihan duplikat per pelanggan per bulan (jatuh_tempo berbeda tapi bulan sama).
 * Pertahankan satu: Terbayar > Belum, lalu yang punya data input/pembayaran.
 */
export async function dedupeTagihanDuplikatForMitraRouters(
  routerIds: number[],
  options: { bulan?: string } = {},
  db: Prisma.TransactionClient = prisma
): Promise<number> {
  if (routerIds.length === 0) return 0;

  const monthFilter = options.bulan?.trim();
  const where: Prisma.PembayaranWhereInput = {
    pelanggan: { routerId: { in: routerIds } },
  };
  if (monthFilter && /^\d{4}-\d{2}$/.test(monthFilter)) {
    where.jatuh_tempo = monthJatuhTempoRange(monthFilter);
  }

  const rows = await db.pembayaran.findMany({
    where,
    select: {
      id: true,
      pelangganId: true,
      jatuh_tempo: true,
      status: true,
      inputterId: true,
      metode: true,
    },
    orderBy: { id: "asc" },
  });

  const groups = new Map<string, PembayaranLite[]>();
  for (const row of rows) {
    const key = `${row.pelangganId}::${billingPeriodFromJatuhTempo(row.jatuh_tempo)}`;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  const toDelete: number[] = [];
  for (const group of groups.values()) {
    if (group.length <= 1) continue;
    const sorted = [...group].sort((a, b) => keeperScore(b) - keeperScore(a));
    for (const row of sorted.slice(1)) {
      toDelete.push(row.id);
    }
  }

  if (toDelete.length === 0) return 0;

  await db.logBayar.deleteMany({
    where: { pembayaranId: { in: toDelete } },
  });
  const result = await db.pembayaran.deleteMany({
    where: { id: { in: toDelete } },
  });
  return result.count;
}
