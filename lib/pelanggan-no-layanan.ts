import { Prisma } from "@prisma/client";
import prisma from "./prisma";

/** Total digit no layanan. */
export const NO_LAYANAN_DIGITS = 12;
/** 6 digit depan: YYYYMM (tahun + bulan). */
export const NO_LAYANAN_PREFIX_DIGITS = 6;
/** 6 digit belakang: urutan bebas per bulan. */
export const NO_LAYANAN_SUFFIX_DIGITS = 6;

const NO_LAYANAN_SUFFIX_MAX = 10 ** NO_LAYANAN_SUFFIX_DIGITS - 1;

type PelangganNoLayananSource = {
  noLayanan?: string | null;
};

/** Prefix YYYYMM dari tanggal (tahun + bulan berdiri sendiri di depan). */
export function noLayananPrefixFromDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}${m}`;
}

/** Parse tanggal berlangganan pelanggan (fr-CA / ISO). */
export function dateFromPelangganTgl(tgl?: string | null): Date {
  if (tgl?.trim()) {
    const parts = tgl.trim().slice(0, 10).split("-").map(Number);
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return new Date(parts[0], parts[1] - 1, parts[2] || 1);
    }
  }
  return new Date();
}

function buildNoLayanan(prefix: string, sequence: number): string {
  if (prefix.length !== NO_LAYANAN_PREFIX_DIGITS || !/^\d{6}$/.test(prefix)) {
    throw new Error("Prefix no layanan tidak valid");
  }
  if (
    !Number.isInteger(sequence) ||
    sequence < 1 ||
    sequence > NO_LAYANAN_SUFFIX_MAX
  ) {
    throw new Error("Urutan no layanan tidak valid atau sudah penuh");
  }
  return prefix + String(sequence).padStart(NO_LAYANAN_SUFFIX_DIGITS, "0");
}

/**
 * Format lama (INT → LPAD 12 digit) seperti 000000000060.
 * Format benar: YYYYMM + 6 digit urutan, mis. 202605000054.
 */
export function isLegacyNoLayanan(value?: string | null): boolean {
  const stored = value?.trim();
  if (!stored) return true;
  if (!/^\d{1,12}$/.test(stored)) return true;
  const padded = stored.padStart(NO_LAYANAN_DIGITS, "0");
  if (!/^\d{12}$/.test(padded)) return true;
  const year = Number.parseInt(padded.slice(0, 4), 10);
  const month = Number.parseInt(padded.slice(4, 6), 10);
  if (year < 2000 || year > 2100) return true;
  if (month < 1 || month > 12) return true;
  return false;
}

/** Nomor layanan untuk invoice / kuitansi (12 digit: YYYYMM + urutan). */
export function resolveNoLayanan(pelanggan: PelangganNoLayananSource): string {
  const stored = pelanggan.noLayanan?.trim();
  if (!stored) return "-";
  if (/^\d{12}$/.test(stored) && !isLegacyNoLayanan(stored)) return stored;
  if (/^\d{12}$/.test(stored)) return stored; // legacy tetap ditampilkan apa adanya sampai di-reformat
  if (/^\d+$/.test(stored)) return stored.padStart(NO_LAYANAN_DIGITS, "0");
  return stored;
}

function isNoLayananUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002" &&
    Array.isArray(err.meta?.target) &&
    (err.meta.target as string[]).includes("noLayanan")
  );
}

async function nextSequenceForPrefix(
  prefix: string,
  tx: Prisma.TransactionClient = prisma
): Promise<number> {
  const latest = await tx.pelanggan.findFirst({
    where: {
      noLayanan: { startsWith: prefix },
      // Abaikan format legacy 000000… agar tidak mengunci urutan bulan
      NOT: { noLayanan: { startsWith: "000000" } },
    },
    orderBy: { noLayanan: "desc" },
    select: { noLayanan: true },
  });
  if (!latest?.noLayanan) return 1;
  const suffix = latest.noLayanan.slice(prefix.length);
  const n = Number.parseInt(suffix, 10);
  return Number.isFinite(n) && n > 0 ? n + 1 : 1;
}

/** Alokasi no layanan: YYYYMM (dari tanggal berlangganan) + urutan 6 digit. */
export async function allocateNoLayananForCreate(
  referenceDate: Date = new Date(),
  tx: Prisma.TransactionClient = prisma
): Promise<string> {
  const prefix = noLayananPrefixFromDate(referenceDate);
  const lockName = `router_monitor_no_layanan_${prefix}`;

  const run = async (client: Prisma.TransactionClient) => {
    const got = await client.$queryRaw<Array<{ ok: number | bigint | null }>>`
      SELECT GET_LOCK(${lockName}, 15) AS ok
    `;
    const okRaw = got[0]?.ok;
    const ok = typeof okRaw === "bigint" ? Number(okRaw) : Number(okRaw);
    if (ok !== 1) {
      throw new Error("Gagal mengalokasi nomor layanan (sistem sibuk, coba lagi)");
    }
    try {
      let seq = await nextSequenceForPrefix(prefix, client);
      for (let attempt = 0; attempt < 32; attempt++) {
        const noLayanan = buildNoLayanan(prefix, seq);
        const taken = await client.pelanggan.findUnique({
          where: { noLayanan },
          select: { id: true },
        });
        if (!taken) return noLayanan;
        seq += 1;
      }
      throw new Error("Gagal mengalokasi nomor layanan");
    } finally {
      await client.$executeRaw`SELECT RELEASE_LOCK(${lockName})`;
    }
  };

  if (tx === prisma) {
    return prisma.$transaction((inner) => run(inner), {
      maxWait: 15_000,
      timeout: 30_000,
    });
  }
  return run(tx);
}

/**
 * Pastikan pelanggan punya no layanan format YYYYMM+urutan.
 * Format legacy (000000000060) akan diganti.
 */
export async function ensurePelangganNoLayanan(
  pelangganId: number,
  existing?: string | null,
  referenceDate?: Date
): Promise<string> {
  const normalized = existing?.trim();
  if (normalized && !isLegacyNoLayanan(normalized)) {
    return resolveNoLayanan({ noLayanan: normalized });
  }

  const row = await prisma.pelanggan.findUnique({
    where: { id: pelangganId },
    select: { tgl: true, created: true, noLayanan: true },
  });

  if (row?.noLayanan && !isLegacyNoLayanan(row.noLayanan)) {
    return resolveNoLayanan(row);
  }

  const ref =
    referenceDate ??
    (row?.tgl?.trim()
      ? dateFromPelangganTgl(row.tgl)
      : row?.created
        ? new Date(row.created)
        : new Date());

  for (let attempt = 0; attempt < 8; attempt++) {
    const noLayanan = await allocateNoLayananForCreate(ref);
    try {
      const updated = await prisma.pelanggan.update({
        where: { id: pelangganId },
        data: { noLayanan },
        select: { noLayanan: true },
      });
      return resolveNoLayanan(updated);
    } catch (err) {
      if (isNoLayananUniqueViolation(err)) continue;
      throw err;
    }
  }

  throw new Error("Gagal mengalokasi nomor layanan");
}

/**
 * Reformat semua no layanan legacy → YYYYMM (dari tgl / created) + urutan.
 * Aman dijalankan berulang (idempotent untuk yang sudah benar).
 */
export async function reformatAllLegacyNoLayanan(): Promise<{
  total: number;
  updated: number;
  skipped: number;
}> {
  const rows = await prisma.pelanggan.findMany({
    select: { id: true, tgl: true, created: true, noLayanan: true },
    orderBy: { id: "asc" },
  });

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    if (!isLegacyNoLayanan(row.noLayanan)) {
      skipped += 1;
      continue;
    }
    const ref = row.tgl?.trim()
      ? dateFromPelangganTgl(row.tgl)
      : new Date(row.created);
    await ensurePelangganNoLayanan(row.id, null, ref);
    updated += 1;
  }

  return { total: rows.length, updated, skipped };
}
