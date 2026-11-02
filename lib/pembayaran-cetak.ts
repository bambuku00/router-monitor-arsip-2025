import prisma from "@/lib/prisma";
import {
  pelangganIsolirFilterClause,
  type IsolirPelangganFilter,
} from "@/lib/pembayaran-isolir-filter";
import { parseJatuhTempoParts } from "@/lib/pembayaran-tax";
import {
  parseStaffAsQueryParam,
  resolveStaffPelangganScopeWhere,
} from "@/lib/staff-pelanggan-scope";
import type { User } from "lucia";

export type PembayaranCetakBayarFilter = "semua" | "belum" | "terbayar";

export function parsePembayaranCetakBayarFilter(
  raw: string | null | undefined
): PembayaranCetakBayarFilter {
  if (raw === "belum" || raw === "terbayar") return raw;
  return "semua";
}

export type PembayaranCetakRow = {
  id: number;
  total: number;
  status: "Belum" | "Terbayar";
  jatuh_tempo: string;
  metode: string | null;
  pelanggan: {
    nama: string;
    alamat: string;
    nomor: string;
    tgl_isolir: number | null;
    router: { nama: string };
    ppp_secret: { name: string } | null;
    paket: { nama: string };
  };
};

export type PembayaranCetakData = {
  mitraNama: string;
  bulanLabel: string;
  bulan: string;
  belum: PembayaranCetakRow[];
  terbayar: PembayaranCetakRow[];
  totalBelum: number;
  totalTerbayar: number;
  bayarFilter: PembayaranCetakBayarFilter;
  isolirFilter: IsolirPelangganFilter;
  staffLabel: string | null;
};

function monthRange(bulan: string) {
  const [y, m] = bulan.split("-").map(Number);
  return {
    gte: new Date(y, m - 1, 1).toLocaleDateString("fr-CA"),
    lte: new Date(y, m, 0).toLocaleDateString("fr-CA"),
    label: new Intl.DateTimeFormat("id-ID", {
      month: "long",
      year: "numeric",
    }).format(new Date(y, m - 1, 1)),
  };
}

export function formatJatuhTempoId(jatuh_tempo: string) {
  const { year, month, day } = parseJatuhTempoParts(jatuh_tempo);
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

/** Format singkat untuk kolom cetak agar lebar kolom konsisten. */
export function formatJatuhTempoCetak(jatuh_tempo: string) {
  const { year, month, day } = parseJatuhTempoParts(jatuh_tempo);
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

/** Format tanggal isolir pelanggan untuk cetak; kosong → "—". */
export function formatTglIsolirCetak(
  tgl: number | null | undefined
): string {
  if (tgl == null) return "—";
  return `Tgl ${tgl}`;
}

export async function getPembayaranCetakData(
  mitraUserId: number,
  bulan: string,
  actor: Pick<User, "id" | "role" | "parentId">,
  options?: {
    staffAs?: string | null;
    bayar?: PembayaranCetakBayarFilter;
    isolir?: IsolirPelangganFilter;
    routerId?: number | null;
  }
): Promise<PembayaranCetakData | null> {
  if (!/^\d{4}-\d{2}$/.test(bulan)) return null;

  const staffAs = options?.staffAs ?? null;
  const bayarFilter = options?.bayar ?? "semua";
  const isolirFilter = options?.isolir ?? "semua";
  const routerId =
    options?.routerId && options.routerId > 0 ? options.routerId : null;

  const range = monthRange(bulan);
  const staffPelangganWhere = await resolveStaffPelangganScopeWhere(
    actor,
    mitraUserId,
    staffAs
  );

  const staffAsId = parseStaffAsQueryParam(staffAs);
  const staffLabelPromise =
    staffAsId != null
      ? prisma.user.findFirst({
          where: { id: staffAsId, parentId: mitraUserId },
          select: { nama: true, user: true, role: true },
        })
      : Promise.resolve(null);

  const routersPromise = prisma.router.findMany({
    where: { userId: mitraUserId },
    select: { id: true, isolirProfileName: true, deleted: true },
  });
  const routers = await routersPromise;
  const ownedRouterId =
    routerId && routers.some((row) => row.id === routerId && !row.deleted)
      ? routerId
      : null;

  const isolirWhere = pelangganIsolirFilterClause(isolirFilter, routers);

  const statusWhere =
    bayarFilter === "belum"
      ? { status: "Belum" as const }
      : bayarFilter === "terbayar"
        ? { status: "Terbayar" as const }
        : {};

  const [mitra, staffRow, rows] = await Promise.all([
    prisma.user.findUnique({
      where: { id: mitraUserId },
      select: { nama: true, user: true },
    }),
    staffLabelPromise,
    prisma.pembayaran.findMany({
      where: {
        jatuh_tempo: { gte: range.gte, lte: range.lte },
        ...statusWhere,
        pelanggan: {
          router: {
            userId: mitraUserId,
            ...(ownedRouterId ? { id: ownedRouterId } : {}),
          },
          ...staffPelangganWhere,
          ...(isolirWhere ?? {}),
        },
      },
      select: {
        id: true,
        total: true,
        status: true,
        jatuh_tempo: true,
        metode: true,
        pelanggan: {
          select: {
            nama: true,
            alamat: true,
            nomor: true,
            tgl_isolir: true,
            router: { select: { nama: true } },
            ppp_secret: { select: { name: true } },
            paket: { select: { nama: true } },
          },
        },
      },
      orderBy: [{ pelanggan: { nama: "asc" } }, { id: "asc" }],
    }),
  ]);

  if (!mitra) return null;

  const belum =
    bayarFilter === "terbayar"
      ? []
      : (rows.filter((r) => r.status === "Belum") as PembayaranCetakRow[]);
  const terbayar =
    bayarFilter === "belum"
      ? []
      : (rows.filter((r) => r.status === "Terbayar") as PembayaranCetakRow[]);

  const staffLabel = staffRow
    ? `${staffRow.nama || staffRow.user} (${staffRow.role})`
    : null;

  return {
    mitraNama: mitra.nama || mitra.user,
    bulanLabel: range.label,
    bulan,
    belum,
    terbayar,
    totalBelum: belum.reduce((s, r) => s + Number(r.total), 0),
    totalTerbayar: terbayar.reduce((s, r) => s + Number(r.total), 0),
    bayarFilter,
    isolirFilter,
    staffLabel,
  };
}
