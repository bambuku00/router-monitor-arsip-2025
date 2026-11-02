import { monthJatuhTempoRange } from "@/lib/billing-due-date";
import {
  listUserIdProsesKantor,
  pembayaranLunasKantorWhere,
} from "@/lib/pembayaran-rekap-petugas";
import { nominalPaketForDisplay } from "@/lib/paket-persist";
import {
  rekapTunaiTransferPerPaket,
  type RekapMetodeBaris,
} from "@/lib/penagih-rekap-metode";
import prisma from "@/lib/prisma";

export type PenagihRekapMetodeData = {
  bulan: string;
  penagih: { id: number; nama: string };
  data: RekapMetodeBaris[];
};

export async function loadPenagihRekapMetode(params: {
  ownerUserId: number;
  penagihId: number;
  bulan: string;
}): Promise<PenagihRekapMetodeData | null> {
  const penagih = await prisma.penagih.findFirst({
    where: { id: params.penagihId, ownerUserId: params.ownerUserId },
    select: { id: true, nama: true },
  });
  if (!penagih) return null;

  const owner = await prisma.user.findFirst({
    where: { id: params.ownerUserId },
    select: { ppn: true },
  });
  const ppnPercent = owner?.ppn ?? 11;

  const lunasKantor = pembayaranLunasKantorWhere(
    await listUserIdProsesKantor(params.ownerUserId)
  );

  const rows = await prisma.pembayaran.findMany({
    where: {
      status: { in: ["Belum", "Terbayar"] },
      jatuh_tempo: monthJatuhTempoRange(params.bulan),
      pelanggan: {
        router: { userId: params.ownerUserId, deleted: false },
        penagihPenugasan: { penagihId: penagih.id },
      },
      ...(lunasKantor ? { NOT: lunasKantor } : {}),
    },
    select: {
      total: true,
      metode: true,
      status: true,
      paket: {
        select: { id: true, nama: true, harga: true, nominalPembayaran: true },
      },
    },
  });

  return {
    bulan: params.bulan,
    penagih,
    data: rekapTunaiTransferPerPaket(
      rows.map((row) => ({
        ...row,
        paket: {
          id: row.paket.id,
          nama: row.paket.nama,
          harga: nominalPaketForDisplay(row.paket, ppnPercent),
        },
      }))
    ),
  };
}
