import type { Prisma } from "@prisma/client";

/** Pelanggan yang layak tampil di penagihan / generate tagihan (PPP masih ada di DB). */
export const pelangganUntukPenagihanWhere = {
  ppp_secret: { is: { id: { gt: 0 } } },
} satisfies Prisma.PelangganWhereInput;
