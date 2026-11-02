import { Prisma, type RoleName, type StatusBayar } from "@prisma/client";
import { visibleInputter } from "@/lib/pembayaran-petugas-response";
import prisma from "@/lib/prisma";

export type PembayaranInputterInfo = {
  id: number;
  nama: string;
  user?: string;
  role?: RoleName;
};

type PembayaranInputterRow = {
  id: number;
  status: StatusBayar | string;
  inputterId: number | null;
  updated?: Date | string;
};

export function formatPembayaranInputterLabel(
  inputter: PembayaranInputterInfo | null | undefined
): string {
  if (!inputter) return "—";
  if (!inputter.role) return inputter.nama;
  return `${inputter.nama} (${inputter.role})`;
}

export function formatPembayaranProcessorLabel(
  inputter: PembayaranInputterInfo | null | undefined,
  viaTripay?: boolean
): string {
  if (viaTripay) return "Tripay";
  return formatPembayaranInputterLabel(inputter);
}

/** Callback Tripay menulis log beberapa detik setelah status transaksi berubah. */
export function pembayaranLunasLewatTripay(
  logCreated: Date | null | undefined,
  tripayUpdated: Date | null | undefined
): boolean {
  if (!logCreated || !tripayUpdated) return false;
  const delta = logCreated.getTime() - tripayUpdated.getTime();
  return delta >= -60_000 && delta <= 15 * 60 * 1000;
}

/** Orang yang pernah menandai lunas pada rentang bulan tagihan ini. */
export async function listPembayaranInputtersForRange(params: {
  routerIds: number[];
  jatuhTempo: { gte: string; lte: string };
  pelangganWhere?: Prisma.PelangganWhereInput;
}) {
  if (params.routerIds.length === 0) return [];
  const pelanggan = {
    routerId: { in: params.routerIds },
    ...params.pelangganWhere,
  };
  const [langsung, lewatLog] = await Promise.all([
    prisma.pembayaran.findMany({
      where: {
        status: "Terbayar",
        inputterId: { not: null },
        jatuh_tempo: params.jatuhTempo,
        pelanggan,
      },
      distinct: ["inputterId"],
      select: { inputterId: true },
    }),
    prisma.pembayaran.findMany({
      where: {
        status: "Terbayar",
        inputterId: null,
        jatuh_tempo: params.jatuhTempo,
        pelanggan,
        log: { some: { status: "Terbayar" } },
      },
      select: {
        log: {
          where: { status: "Terbayar" },
          orderBy: { created: "desc" },
          take: 1,
          select: { inputterId: true },
        },
      },
    }),
  ]);
  const ids = [
    ...new Set(
      [
        ...langsung.map((row) => row.inputterId),
        ...lewatLog.map((row) => row.log[0]?.inputterId),
      ].filter((id): id is number => id != null)
    ),
  ];
  if (ids.length === 0) return [];
  return prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, nama: true, user: true, role: true },
    orderBy: [{ nama: "asc" }, { id: "asc" }],
  });
}

export function jakartaCalendarParts(
  date: Date
): { year: number; month: number; day: number } | null {
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  if (!year || !month || !day) return null;
  return { year, month, day };
}

/** Hari di bulan tagihan yang benar-benar ada catatan pembayaran diproses. */
export async function listPembayaranProcessedDaysForRange(params: {
  routerIds: number[];
  jatuhTempo: { gte: string; lte: string };
  pelangganWhere?: Prisma.PelangganWhereInput;
}): Promise<number[]> {
  if (params.routerIds.length === 0) return [];
  const monthMatch = /^(\d{4})-(\d{2})-\d{2}$/.exec(params.jatuhTempo.gte);
  if (!monthMatch) return [];
  const year = Number(monthMatch[1]);
  const month = Number(monthMatch[2]);

  const rows = await prisma.pembayaran.findMany({
    where: {
      status: "Terbayar",
      jatuh_tempo: params.jatuhTempo,
      pelanggan: {
        routerId: { in: params.routerIds },
        ...params.pelangganWhere,
      },
    },
    select: { id: true, updated: true },
  });
  if (rows.length === 0) return [];

  const logs = await prisma.logBayar.findMany({
    where: {
      pembayaranId: { in: rows.map((row) => row.id) },
      status: "Terbayar",
    },
    orderBy: { created: "desc" },
    select: { pembayaranId: true, created: true },
  });
  const latestLog = new Map<number, Date>();
  for (const log of logs) {
    if (!latestLog.has(log.pembayaranId)) {
      latestLog.set(log.pembayaranId, log.created);
    }
  }

  const days = new Set<number>();
  for (const row of rows) {
    const at = latestLog.get(row.id) ?? row.updated;
    const calendar = jakartaCalendarParts(at);
    if (!calendar || calendar.year !== year || calendar.month !== month) continue;
    days.add(calendar.day);
  }
  return [...days].sort((left, right) => left - right);
}

/** Rentang satu hari kalender Jakarta untuk filter tanggal diproses. */
export function jakartaProcessedDayRange(
  day: string
): { gte: Date; lt: Date } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const start = new Date(`${day}T00:00:00+07:00`);
  if (Number.isNaN(start.getTime())) return null;
  return { gte: start, lt: new Date(start.getTime() + 86_400_000) };
}

export function formatPembayaranProcessedAt(
  processedAt: string | Date | null | undefined,
  style: "short" | "lengkap" = "short"
): string | null {
  if (!processedAt) return null;
  const d = new Date(processedAt);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: style === "lengkap" ? "long" : "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** Lengkapi tagihan Terbayar dengan info user + waktu pencatatan lunas. */
export async function enrichPembayaranWithInputters<
  T extends PembayaranInputterRow,
>(
  rows: T[],
  options?: { audienceRole?: RoleName }
): Promise<
  (T & {
    inputter: PembayaranInputterInfo | null;
    processedAt: string | null;
    viaTripay: boolean;
  })[]
> {
  if (rows.length === 0) return [];

  const paidRows = rows.filter((r) => r.status === "Terbayar");
  if (paidRows.length === 0) {
    return rows.map((r) => ({
      ...r,
      inputter: null,
      processedAt: null,
      viaTripay: false,
    }));
  }

  const paidIds = paidRows.map((r) => r.id);
  const logs = await prisma.logBayar.findMany({
    where: {
      pembayaranId: { in: paidIds },
      status: "Terbayar",
    },
    orderBy: { created: "desc" },
    select: { pembayaranId: true, inputterId: true, created: true },
  });

  const latestLogByPembayaran = new Map<
    number,
    { inputterId: number; created: Date }
  >();
  for (const log of logs) {
    if (!latestLogByPembayaran.has(log.pembayaranId)) {
      latestLogByPembayaran.set(log.pembayaranId, {
        inputterId: log.inputterId,
        created: log.created,
      });
    }
  }

  const inputterIds = new Set<number>();
  for (const row of paidRows) {
    const log = latestLogByPembayaran.get(row.id);
    const inputterId = row.inputterId ?? log?.inputterId ?? null;
    if (inputterId != null) inputterIds.add(inputterId);
  }

  const hideStaffIdentity = options?.audienceRole === "Petugas";
  const [users, tripayPaid] = await Promise.all([
    inputterIds.size === 0
      ? Promise.resolve([])
      : prisma.user.findMany({
          where: { id: { in: [...inputterIds] } },
          select: hideStaffIdentity
            ? { id: true, nama: true }
            : { id: true, nama: true, user: true, role: true },
        }),
    prisma.tripayTransaksi.findMany({
      where: { pembayaranId: { in: paidIds }, status: "PAID" },
      select: { pembayaranId: true, updated: true },
    }),
  ]);
  const userMap = new Map(users.map((u) => [u.id, u]));
  const tripayByPembayaran = new Map<number, Date[]>();
  for (const row of tripayPaid) {
    const list = tripayByPembayaran.get(row.pembayaranId) ?? [];
    list.push(row.updated);
    tripayByPembayaran.set(row.pembayaranId, list);
  }

  return rows.map((row) => {
    if (row.status !== "Terbayar") {
      return { ...row, inputter: null, processedAt: null, viaTripay: false };
    }
    const log = latestLogByPembayaran.get(row.id);
    const inputterId = row.inputterId ?? log?.inputterId ?? null;
    const processedAt =
      log?.created.toISOString() ??
      (row.updated ? new Date(row.updated).toISOString() : null);
    const viaTripay = (tripayByPembayaran.get(row.id) ?? []).some((updated) =>
      pembayaranLunasLewatTripay(log?.created, updated)
    );
    if (inputterId == null) {
      return { ...row, inputter: null, processedAt, viaTripay };
    }
    const u = userMap.get(inputterId);
    return {
      ...row,
      inputter: visibleInputter(options?.audienceRole ?? "Admin", u ?? null),
      processedAt,
      viaTripay,
    };
  });
}
