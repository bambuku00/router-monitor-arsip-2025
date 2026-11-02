import {
  computeMitraMonthlyGrossTotal,
} from "@/lib/pembayaran-mitra-rekapan";
import { normalizeRevenueBasis } from "@/lib/revenue-basis";
import prisma from "@/lib/prisma";
import type { RevenueBasis } from "@prisma/client";

/**
 * Pendapatan kotor BHP/USO / bagi hasil mengikuti metode mitra (INVOICE vs PAID).
 */
export async function computeGrossRevenueForPeriod(
  mitraUserId: number,
  year: number,
  month: number,
  basisOverride?: RevenueBasis
): Promise<number> {
  let basis = basisOverride;
  if (!basis) {
    const user = await prisma.user.findUnique({
      where: { id: mitraUserId },
      select: { revenueBasis: true },
    });
    basis = normalizeRevenueBasis(user?.revenueBasis);
  }
  return computeMitraMonthlyGrossTotal(mitraUserId, year, month, basis);
}
