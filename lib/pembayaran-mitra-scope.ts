import type { Prisma, StatusBayar } from "@prisma/client";

import { monthJatuhTempoRange } from "@/lib/billing-due-date";

/**
 * Scope tagihan untuk rekapan mitra — selaras dengan
 * GET /api/pembayaran/tagihan/[id] (statistik di /pembayaran/{mitraId}).
 * Hanya tagihan pelanggan yang router-nya milik mitra (bukan semua paket userId).
 */
export function mitraRekapanPembayaranWhere(
  mitraUserId: number,
  firstDate: string,
  lastDate: string,
  options?: { status?: StatusBayar }
): Prisma.PembayaranWhereInput {
  return {
    jatuh_tempo: { gte: firstDate, lte: lastDate },
    pelanggan: {
      router: { userId: mitraUserId, deleted: false },
    },
    ...(options?.status ? { status: options.status } : {}),
  };
}

export function mitraRekapanPembayaranWhereForBulan(
  mitraUserId: number,
  bulan: string,
  options?: { status?: StatusBayar }
): Prisma.PembayaranWhereInput {
  const range = monthJatuhTempoRange(bulan);
  return mitraRekapanPembayaranWhere(
    mitraUserId,
    range.gte,
    range.lte,
    options
  );
}
