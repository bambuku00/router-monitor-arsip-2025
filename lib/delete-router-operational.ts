import { Prisma } from "@prisma/client";

/**
 * Hapus seluruh data operasional untuk satu atau banyak router (pelanggan, PPP, pembayaran, sync).
 * Urutan aman untuk FK: LogBayar → Pembayaran → PPP/pelanggan → Router.
 */
export async function deleteRoutersOperationalInTransaction(
  tx: Prisma.TransactionClient,
  routerIds: number[]
) {
  if (routerIds.length === 0) return;

  await tx.logBayar.deleteMany({
    where: {
      pembayaran: {
        pelanggan: { routerId: { in: routerIds } },
      },
    },
  });

  await tx.pembayaran.deleteMany({
    where: { pelanggan: { routerId: { in: routerIds } } },
  });

  await tx.pppActive.deleteMany({ where: { routerId: { in: routerIds } } });

  await tx.pelanggan.updateMany({
    where: { routerId: { in: routerIds } },
    data: { ppp_secretId: null },
  });

  await tx.pppSecret.deleteMany({ where: { routerId: { in: routerIds } } });
  await tx.pelanggan.deleteMany({ where: { routerId: { in: routerIds } } });
  await tx.pppSync.deleteMany({ where: { routerId: { in: routerIds } } });
  await tx.router.deleteMany({ where: { id: { in: routerIds } } });
}
