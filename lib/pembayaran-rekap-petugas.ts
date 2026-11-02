import type { Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";

/** Peran kantor yang pencatatannya tidak masuk rekap petugas. */
export const PERAN_LUNAS_BUKAN_PETUGAS = ["Admin", "Keuangan"] as const;

export async function listUserIdProsesKantor(ownerUserId: number): Promise<number[]> {
  const rows = await prisma.user.findMany({
    where: {
      role: { in: [...PERAN_LUNAS_BUKAN_PETUGAS] },
      OR: [{ id: ownerUserId }, { parentId: ownerUserId }],
    },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

function lunasKantorOr(kantorUserIds: number[]): Prisma.PembayaranWhereInput[] {
  return [
    { inputterId: { in: kantorUserIds } },
    {
      inputterId: null,
      log: {
        some: {
          status: "Terbayar",
          inputterId: { in: kantorUserIds },
        },
      },
    },
  ];
}

/** Pelanggan yang tagihan bulannya dilunasi Admin atau Keuangan. */
export function pelangganLunasKantorWhere(
  jatuhTempo: { gte: string; lte: string },
  kantorUserIds: number[]
): Prisma.PelangganWhereInput | null {
  if (kantorUserIds.length === 0) return null;
  return {
    pembayaran: {
      some: {
        jatuh_tempo: jatuhTempo,
        status: "Terbayar",
        OR: lunasKantorOr(kantorUserIds),
      },
    },
  };
}

/** Tagihan lunas yang dicatat Admin atau Keuangan, untuk dikeluarkan dari rekap. */
export function pembayaranLunasKantorWhere(
  kantorUserIds: number[]
): Prisma.PembayaranWhereInput | null {
  if (kantorUserIds.length === 0) return null;
  return {
    status: "Terbayar",
    OR: lunasKantorOr(kantorUserIds),
  };
}
