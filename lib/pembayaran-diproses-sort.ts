import {
  enrichPembayaranWithInputters,
  formatPembayaranProcessorLabel,
} from "@/lib/pembayaran-inputter";
import prisma from "@/lib/prisma";

export type DiprosesSort = "nama" | "tanggal";
export type PelangganUrutan = DiprosesSort | "belum";

export function parseDiprosesSort(value: string | null | undefined): DiprosesSort | null {
  if (value === "nama" || value === "tanggal") return value;
  return null;
}

export function parsePelangganUrutan(
  value: string | null | undefined
): PelangganUrutan | null {
  if (value === "belum") return "belum";
  return parseDiprosesSort(value);
}

/** Tagihan Belum di atas. Kedua kelompok mempertahankan urutan nama yang sudah ada. */
export function urutkanBelumDulu(ids: number[], belumIds: ReadonlySet<number>): number[] {
  const atas: number[] = [];
  const bawah: number[] = [];
  for (const id of ids) {
    if (belumIds.has(id)) atas.push(id);
    else bawah.push(id);
  }
  return [...atas, ...bawah];
}

export async function sortPelangganIdsBelumDulu(
  ids: number[],
  jatuhTempo: { gte: string; lte: string }
): Promise<number[]> {
  if (ids.length === 0) return [];
  const unpaid = await prisma.pembayaran.findMany({
    where: {
      pelangganId: { in: ids },
      status: "Belum",
      jatuh_tempo: jatuhTempo,
    },
    select: { pelangganId: true },
  });
  return urutkanBelumDulu(ids, new Set(unpaid.map((row) => row.pelangganId)));
}

export type DiprosesSortKey = {
  id: number;
  nama: string;
  label: string;
  at: number | null;
};

function emptyProcessor(label: string): boolean {
  const name = label.trim();
  return name.length === 0 || name === "—";
}

/** Nama pemroses A–Z, atau waktu diproses terbaru di atas. Yang kosong di bawah. */
export function compareDiprosesSort(
  left: DiprosesSortKey,
  right: DiprosesSortKey,
  mode: DiprosesSort
): number {
  if (mode === "nama") {
    const leftEmpty = emptyProcessor(left.label);
    const rightEmpty = emptyProcessor(right.label);
    if (leftEmpty !== rightEmpty) return leftEmpty ? 1 : -1;
    const byLabel = left.label.localeCompare(right.label, "id", {
      sensitivity: "base",
    });
    if (byLabel !== 0) return byLabel;
  } else {
    const leftMissing = left.at == null;
    const rightMissing = right.at == null;
    if (leftMissing !== rightMissing) return leftMissing ? 1 : -1;
    if (left.at != null && right.at != null && left.at !== right.at) {
      return right.at - left.at;
    }
  }
  const byNama = left.nama.localeCompare(right.nama, "id", { sensitivity: "base" });
  if (byNama !== 0) return byNama;
  return left.id - right.id;
}

export function sortDiprosesKeys<T extends DiprosesSortKey>(
  rows: T[],
  mode: DiprosesSort
): T[] {
  return [...rows].sort((left, right) => compareDiprosesSort(left, right, mode));
}

export async function sortPelangganIdsByDiproses(
  ids: number[],
  jatuhTempo: { gte: string; lte: string },
  mode: DiprosesSort
): Promise<number[]> {
  if (ids.length === 0) return [];
  const [people, payments] = await Promise.all([
    prisma.pelanggan.findMany({
      where: { id: { in: ids } },
      select: { id: true, nama: true },
    }),
    prisma.pembayaran.findMany({
      where: {
        pelangganId: { in: ids },
        status: "Terbayar",
        jatuh_tempo: jatuhTempo,
      },
      select: {
        id: true,
        pelangganId: true,
        status: true,
        inputterId: true,
        updated: true,
      },
    }),
  ]);
  const enriched = await enrichPembayaranWithInputters(payments);
  const byPelanggan = new Map<number, { label: string; at: number | null }>();
  for (const row of enriched) {
    const at = row.processedAt ? new Date(row.processedAt).getTime() : null;
    const current = byPelanggan.get(row.pelangganId);
    if (current && (current.at ?? -1) >= (at ?? -1)) continue;
    byPelanggan.set(row.pelangganId, {
      label: formatPembayaranProcessorLabel(row.inputter, row.viaTripay),
      at: at != null && Number.isNaN(at) ? null : at,
    });
  }
  const namaById = new Map(people.map((row) => [row.id, row.nama]));
  const keys = ids.map((id) => {
    const diproses = byPelanggan.get(id);
    return {
      id,
      nama: namaById.get(id) ?? "",
      label: diproses?.label ?? "",
      at: diproses?.at ?? null,
    };
  });
  return sortDiprosesKeys(keys, mode).map((row) => row.id);
}
