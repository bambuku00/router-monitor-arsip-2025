import { monthJatuhTempoRange } from "@/lib/billing-due-date";
import { tagihanTotalFromPaket } from "@/lib/paket-persist";
import prisma from "@/lib/prisma";

export function parsePenagihanPeriod(raw: string | null | undefined): string | null {
  const value = raw?.trim() ?? "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null;
  return value;
}

export type PenagihanCetakRow = {
  id: number;
  total: number;
  nama: string;
  alamat: string;
  nomor: string;
};

export type PenagihanCetakGroup = {
  penagihId: number | null;
  penagihNama: string;
  aktif: boolean;
  rows: PenagihanCetakRow[];
};

type PaketFields = {
  id: number;
  harga: number;
  nominalPembayaran: number | null;
};

function queueSyncUnpaid(params: {
  ops: Promise<unknown>[];
  paymentId: number;
  paymentPaketId: number;
  paymentTotal: number;
  pelangganPaketId: number;
  paket: PaketFields;
  ppnPercent: number;
}): number {
  const currentTotal = tagihanTotalFromPaket(params.paket, params.ppnPercent);
  if (
    params.paymentPaketId !== params.pelangganPaketId ||
    params.paymentTotal !== currentTotal
  ) {
    params.ops.push(
      prisma.pembayaran.update({
        where: { id: params.paymentId },
        data: {
          paketId: params.pelangganPaketId,
          total: currentTotal,
        },
      })
    );
  }
  return currentTotal;
}

export async function loadPenagihanCetak(params: {
  ownerUserId: number;
  period: string;
  penagihId: number | null;
}): Promise<{
  mitraNama: string;
  period: string;
  groups: PenagihanCetakGroup[];
}> {
  const range = monthJatuhTempoRange(params.period);

  const [mitra, penugasan] = await Promise.all([
    prisma.user.findUnique({
      where: { id: params.ownerUserId },
      select: { nama: true, ppn: true },
    }),
    prisma.penagihPenugasan.findMany({
      where: {
        ownerUserId: params.ownerUserId,
        ...(params.penagihId ? { penagihId: params.penagihId } : {}),
        penagih: params.penagihId
          ? undefined
          : { ownerUserId: params.ownerUserId },
      },
      orderBy: { pelanggan: { nama: "asc" } },
      select: {
        penagih: { select: { id: true, nama: true, aktif: true } },
        pelanggan: {
          select: {
            id: true,
            nama: true,
            alamat: true,
            nomor: true,
            paketId: true,
            paket: {
              select: { id: true, harga: true, nominalPembayaran: true },
            },
            pembayaran: {
              where: {
                status: "Belum",
                jatuh_tempo: { gte: range.gte, lte: range.lte },
              },
              orderBy: { jatuh_tempo: "asc" },
              select: { id: true, total: true, paketId: true },
            },
          },
        },
      },
    }),
  ]);

  const ppnPercent = mitra?.ppn ?? 11;
  const groups = new Map<string, PenagihanCetakGroup>();
  const syncOps: Promise<unknown>[] = [];

  for (const item of penugasan) {
    const penagih = item.penagih;
    const key = String(penagih.id);
    const group = groups.get(key) ?? {
      penagihId: penagih.id,
      penagihNama: penagih.nama,
      aktif: penagih.aktif,
      rows: [],
    };

    const unpaid = item.pelanggan.pembayaran;
    let unpaidTotal = 0;
    if (unpaid.length > 0) {
      unpaidTotal = queueSyncUnpaid({
        ops: syncOps,
        paymentId: unpaid[0].id,
        paymentPaketId: unpaid[0].paketId,
        paymentTotal: unpaid[0].total,
        pelangganPaketId: item.pelanggan.paketId,
        paket: item.pelanggan.paket,
        ppnPercent,
      });
      for (const pay of unpaid.slice(1)) {
        queueSyncUnpaid({
          ops: syncOps,
          paymentId: pay.id,
          paymentPaketId: pay.paketId,
          paymentTotal: pay.total,
          pelangganPaketId: item.pelanggan.paketId,
          paket: item.pelanggan.paket,
          ppnPercent,
        });
      }
    }

    group.rows.push({
      id: unpaid[0]?.id ?? item.pelanggan.id,
      total: unpaidTotal,
      nama: item.pelanggan.nama,
      alamat: item.pelanggan.alamat,
      // Kolom no. tlp sengaja dikosongkan dulu di berkas cetak.
      nomor: "",
    });
    groups.set(key, group);
  }

  // Tanpa filter petugas: sertakan juga tagihan Belum yang belum ditugaskan.
  if (params.penagihId == null) {
    const orphan = await prisma.pembayaran.findMany({
      where: {
        status: "Belum",
        jatuh_tempo: { gte: range.gte, lte: range.lte },
        pelanggan: {
          router: { userId: params.ownerUserId, deleted: false },
          penagihPenugasan: null,
        },
      },
      orderBy: [{ pelanggan: { nama: "asc" } }, { jatuh_tempo: "asc" }],
      select: {
        id: true,
        total: true,
        paketId: true,
        pelanggan: {
          select: {
            nama: true,
            alamat: true,
            paketId: true,
            paket: {
              select: { id: true, harga: true, nominalPembayaran: true },
            },
          },
        },
      },
    });
    if (orphan.length > 0) {
      groups.set("none", {
        penagihId: null,
        penagihNama: "Belum ditugaskan",
        aktif: true,
        rows: orphan.map((row) => ({
          id: row.id,
          total: queueSyncUnpaid({
            ops: syncOps,
            paymentId: row.id,
            paymentPaketId: row.paketId,
            paymentTotal: row.total,
            pelangganPaketId: row.pelanggan.paketId,
            paket: row.pelanggan.paket,
            ppnPercent,
          }),
          nama: row.pelanggan.nama,
          alamat: row.pelanggan.alamat,
          nomor: "",
        })),
      });
    }
  }

  if (syncOps.length > 0) {
    await Promise.all(syncOps);
  }

  return {
    mitraNama: mitra?.nama ?? "Mitra",
    period: params.period,
    groups: [...groups.values()].sort((a, b) =>
      a.penagihNama.localeCompare(b.penagihNama, "id")
    ),
  };
}
