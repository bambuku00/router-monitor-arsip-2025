import type { Prisma, RevenueBasis } from "@prisma/client";

import { monthJatuhTempoRange } from "@/lib/billing-due-date";
import {
  listUserIdProsesKantor,
  pembayaranLunasKantorWhere,
} from "@/lib/pembayaran-rekap-petugas";
import { mitraRekapanPembayaranWhereForBulan } from "@/lib/pembayaran-mitra-scope";
import { bagiPendapatanBersihMitraKantor } from "@/lib/pembayaran-split";
import { ppnNominalPerBaris } from "@/lib/pembayaran-tax";
import { isPaidRevenueBasis, normalizeRevenueBasis } from "@/lib/revenue-basis";
import { getRegulatorySummaryForPembayaran } from "@/lib/regulatory-summary";
import {
  effectivePpnPercentFromPolicy,
  resolveMitraPpnPolicy,
} from "@/lib/ppn-policy";
import prisma from "@/lib/prisma";

export type MitraTagihanStatistik = {
  total: number;
  terbayar: number;
  belum: number;
  tunai: number;
  transfer: number;
  jumlahTunai: number;
  jumlahTransfer: number;
  transferBank: TransferBankRingkas[];
  grossBagiHasil: number;
  revenueBasis: RevenueBasis;
  ppn: number;
  ppnPercent: number;
  ppnEnabled: boolean;
  bhpUso: number;
  pendapatan: number;
  kantor: number;
  mitra: number;
  tagihan: number;
  ownedByIsp: boolean;
};

export type TransferBankRingkas = {
  nama: string;
  norek: string | null;
  jumlah: number;
  nominal: number;
};

type PembayaranRow = {
  total: number;
  status: string;
  metode?: "Cash" | "Transfer" | null;
  bank?: { bank: string; norek?: string | null } | null;
  paket: { harga: number };
};

export function sumTunaiTransfer(rows: Array<Pick<PembayaranRow, "total" | "status" | "metode">>) {
  let tunai = 0;
  let transfer = 0;
  let jumlahTunai = 0;
  let jumlahTransfer = 0;
  for (const row of rows) {
    if (row.status !== "Terbayar") continue;
    if (row.metode === "Cash") {
      tunai += row.total;
      jumlahTunai += 1;
    } else if (row.metode === "Transfer") {
      transfer += row.total;
      jumlahTransfer += 1;
    }
  }
  return { tunai, transfer, jumlahTunai, jumlahTransfer };
}

export function sumTransferPerBank(
  rows: Array<Pick<PembayaranRow, "total" | "status" | "metode" | "bank">>
): TransferBankRingkas[] {
  const grouped = new Map<string, TransferBankRingkas>();
  for (const row of rows) {
    if (row.status !== "Terbayar" || row.metode !== "Transfer") continue;
    const nama = row.bank?.bank?.trim() || "Tanpa bank";
    const norek = row.bank?.norek?.trim() || null;
    const key = `${nama.toLocaleLowerCase("id-ID")}\n${norek ?? ""}`;
    const current = grouped.get(key) ?? { nama, norek, jumlah: 0, nominal: 0 };
    current.jumlah += 1;
    current.nominal += row.total;
    grouped.set(key, current);
  }
  return [...grouped.values()].sort(
    (a, b) => b.nominal - a.nominal || a.nama.localeCompare(b.nama, "id")
  );
}

function aggregateTagihanRows(
  rows: PembayaranRow[],
  ppnPercent: number,
  revenueBasis: RevenueBasis
): Omit<
  MitraTagihanStatistik,
  "bhpUso" | "pendapatan" | "kantor" | "mitra" | "tagihan" | "ownedByIsp"
> & {
  grossBagiHasil: number;
  ppn: number;
} {
  const total = rows.reduce((acc, val) => acc + val.total, 0);
  const terbayar = rows
    .filter((p) => p.status === "Terbayar")
    .reduce((acc, val) => acc + val.total, 0);
  const belum = total - terbayar;
  const { tunai, transfer, jumlahTunai, jumlahTransfer } = sumTunaiTransfer(rows);
  const transferBank = sumTransferPerBank(rows);

  const rowsForSplit = isPaidRevenueBasis(revenueBasis)
    ? rows.filter((p) => p.status === "Terbayar")
    : rows;
  const grossBagiHasil = rowsForSplit.reduce((acc, val) => acc + val.total, 0);
  const ppn =
    ppnPercent <= 0
      ? 0
      : rowsForSplit.reduce(
          (acc, val) =>
            acc + ppnNominalPerBaris(val.total, val.paket.harga, ppnPercent),
          0
        );

  return {
    total,
    terbayar,
    belum,
    tunai,
    transfer,
    jumlahTunai,
    jumlahTransfer,
    transferBank,
    grossBagiHasil,
    revenueBasis,
    ppn,
    ppnPercent,
    ppnEnabled: ppnPercent > 0,
  };
}

/**
 * Statistik tagihan mitra — sama dengan GET /api/pembayaran/tagihan/[id]
 * (panel statistik di /pembayaran/{mitraId}).
 */
export async function computeMitraTagihanStatistik(
  mitraUserId: number,
  bulan: string,
  options?: {
    staffPelangganWhere?: Prisma.PelangganWhereInput;
    isolirWhere?: Prisma.PelangganWhereInput | null;
    penagihWhere?: Prisma.PelangganWhereInput | null;
    routerId?: number | null;
    /** Rekap petugas: tagihan lunas Admin/Keuangan tidak dihitung. */
    sembunyikanLunasKantor?: boolean;
  }
): Promise<MitraTagihanStatistik> {
  const [userSettings, ppnPolicy] = await Promise.all([
    prisma.user.findFirst({
      select: {
        omset: true,
        revenueBasis: true,
        revenueShareEnabled: true,
        ownedByIsp: true,
      },
      where: { id: mitraUserId },
    }),
    resolveMitraPpnPolicy(mitraUserId),
  ]);
  const ppnPercent = effectivePpnPercentFromPolicy(ppnPolicy);
  const revenueBasis = normalizeRevenueBasis(userSettings?.revenueBasis);

  const pelangganScope: Prisma.PelangganWhereInput = {
    AND: [
      options?.staffPelangganWhere ?? {},
      {
        router: {
          userId: mitraUserId,
          deleted: false,
          ...(options?.routerId ? { id: options.routerId } : {}),
        },
      },
      ...(options?.isolirWhere && Object.keys(options.isolirWhere).length > 0
        ? [options.isolirWhere]
        : []),
      ...(options?.penagihWhere && Object.keys(options.penagihWhere).length > 0
        ? [options.penagihWhere]
        : []),
    ],
  };

  const lunasKantor = options?.sembunyikanLunasKantor
    ? pembayaranLunasKantorWhere(await listUserIdProsesKantor(mitraUserId))
    : null;

  const rows = await prisma.pembayaran.findMany({
    where: {
      jatuh_tempo: monthJatuhTempoRange(bulan),
      pelanggan: pelangganScope,
      ...(lunasKantor ? { NOT: lunasKantor } : {}),
    },
    select: {
      total: true,
      status: true,
      metode: true,
      bank: { select: { bank: true, norek: true } },
      paket: { select: { harga: true } },
    },
  });

  const partial = aggregateTagihanRows(rows, ppnPercent, revenueBasis);
  const regulatory = await getRegulatorySummaryForPembayaran(
    mitraUserId,
    partial.grossBagiHasil
  );
  const bhpUso = regulatory.bhpAmount + regulatory.usoAmount;
  const bersih = Math.max(0, partial.grossBagiHasil - partial.ppn - bhpUso);
  const split = bagiPendapatanBersihMitraKantor(
    bersih,
    userSettings?.omset,
    userSettings?.revenueShareEnabled !== false
  );

  return {
    ...partial,
    bhpUso,
    pendapatan: bersih,
    kantor: split.kantor,
    mitra: split.mitra,
    tagihan: split.kantor + partial.ppn + bhpUso,
    ownedByIsp: userSettings?.ownedByIsp === true,
    ppnEnabled: ppnPolicy.ppnEnabled,
  };
}

/** Agregat harian tagihan pelanggan mitra (dashboard chart). */
export async function listMitraPembayaranBulanRows(
  mitraUserId: number,
  bulan: string
) {
  return prisma.pembayaran.findMany({
    where: mitraRekapanPembayaranWhereForBulan(mitraUserId, bulan),
    select: { total: true, status: true, jatuh_tempo: true },
  });
}
