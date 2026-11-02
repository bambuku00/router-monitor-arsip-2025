import prisma from "@/lib/prisma";

/**
 * PPP secret tanpa kartu pelanggan (sama logika tab Belum di /router/:id/ppp),
 * per routerId. Bukan rumus (jumlah PPP − total pelanggan router).
 */
export async function countPppTanpaPelangganByRouterId(): Promise<
  Map<number, number>
> {
  const rows = await prisma.pppSecret.groupBy({
    by: ["routerId"],
    where: {
      pelanggan: { is: null },
    },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.routerId, r._count._all]));
}
