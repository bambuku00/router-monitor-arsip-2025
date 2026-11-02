import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

async function deletePelangganByIds(
  db: Prisma.TransactionClient,
  pelangganIds: number[]
): Promise<number> {
  if (pelangganIds.length === 0) return 0;

  const pembayaranIds = (
    await db.pembayaran.findMany({
      where: { pelangganId: { in: pelangganIds } },
      select: { id: true },
    })
  ).map((p) => p.id);

  if (pembayaranIds.length > 0) {
    await db.logBayar.deleteMany({
      where: { pembayaranId: { in: pembayaranIds } },
    });
    await db.pembayaran.deleteMany({
      where: { id: { in: pembayaranIds } },
    });
  }

  const result = await db.pelanggan.deleteMany({
    where: { id: { in: pelangganIds } },
  });
  return result.count;
}

/**
 * Hapus pelanggan yatim (belum terhubung ke secret PPP).
 * Pelanggan yang sudah punya secret tidak dihapus, walaupun namanya sama.
 */
export async function dedupePelangganForMitraRouters(
  routerIds: number[],
  db: Prisma.TransactionClient = prisma
): Promise<number> {
  if (routerIds.length === 0) return 0;

  const rows = await db.pelanggan.findMany({
    where: {
      routerId: { in: routerIds },
      ppp_secretId: null,
    },
    select: { id: true },
  });

  const ids = rows.map((row) => row.id);
  if (ids.length === 0) return 0;
  return deletePelangganByIds(db, ids);
}
