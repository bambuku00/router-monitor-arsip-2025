import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export const NO_INVOICE_DIGITS = 6;
const NO_INVOICE_MAX = 10 ** NO_INVOICE_DIGITS - 1;
const ALLOC_LOCK_NAME = "router_monitor_no_invoice";
const ALLOC_LOCK_TIMEOUT_SEC = 20;
const ALLOC_MAX_ATTEMPTS = 32;

type PembayaranNoInvoiceSource = {
  noInvoice?: string | null;
  id?: number;
};

export function formatNoInvoice(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1 || sequence > NO_INVOICE_MAX) {
    throw new Error("Nomor invoice tidak valid atau sudah penuh");
  }
  return String(sequence).padStart(NO_INVOICE_DIGITS, "0");
}

function parseNoInvoiceSequence(value: string | null | undefined): number {
  if (!value?.trim()) return 0;
  const n = Number.parseInt(value.trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Nomor invoice untuk cetak / barcode (6 digit). */
export function resolveNoInvoice(pembayaran: PembayaranNoInvoiceSource): string {
  const stored = pembayaran.noInvoice?.trim();
  if (stored && /^\d{6}$/.test(stored)) return stored;
  if (stored && /^\d+$/.test(stored)) {
    return stored.padStart(NO_INVOICE_DIGITS, "0").slice(-NO_INVOICE_DIGITS);
  }
  if (pembayaran.id != null) {
    return formatNoInvoice(Math.min(pembayaran.id, NO_INVOICE_MAX));
  }
  return "000000";
}

function isNoInvoiceUniqueViolation(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002" &&
    Array.isArray(err.meta?.target) &&
    (err.meta.target as string[]).includes("noInvoice")
  );
}

async function nextInvoiceSequence(
  tx: Prisma.TransactionClient
): Promise<number> {
  // MAX numerik — lebih aman dari MAX string pada CHAR(6).
  const rows = await tx.$queryRaw<Array<{ maxSeq: number | bigint | null }>>`
    SELECT COALESCE(MAX(CAST(noInvoice AS UNSIGNED)), 0) AS maxSeq
    FROM Pembayaran
  `;
  const raw = rows[0]?.maxSeq ?? 0;
  const maxSeq = typeof raw === "bigint" ? Number(raw) : Number(raw);
  return (Number.isFinite(maxSeq) ? maxSeq : 0) + 1;
}

async function withInvoiceAllocLock<T>(
  tx: Prisma.TransactionClient,
  fn: () => Promise<T>
): Promise<T> {
  const got = await tx.$queryRaw<Array<{ ok: number | bigint | null }>>`
    SELECT GET_LOCK(${ALLOC_LOCK_NAME}, ${ALLOC_LOCK_TIMEOUT_SEC}) AS ok
  `;
  const okRaw = got[0]?.ok;
  const ok = typeof okRaw === "bigint" ? Number(okRaw) : Number(okRaw);
  if (ok !== 1) {
    throw new Error(
      "Gagal mengalokasi nomor invoice (sistem sibuk, coba lagi)"
    );
  }
  try {
    return await fn();
  } finally {
    await tx.$executeRaw`SELECT RELEASE_LOCK(${ALLOC_LOCK_NAME})`;
  }
}

/**
 * Alokasi rentang nomor invoice di dalam transaksi + advisory lock MySQL.
 * Jika rentang bentrok, maju ke setelah nomor tertinggi yang bentrok (bukan retry MAX yang sama).
 */
export async function allocateNoInvoiceBatch(
  count: number,
  tx: Prisma.TransactionClient = prisma
): Promise<string[]> {
  if (count <= 0) return [];
  if (count > NO_INVOICE_MAX) {
    throw new Error("Permintaan nomor invoice melebihi kapasitas");
  }

  const run = async (client: Prisma.TransactionClient) =>
    withInvoiceAllocLock(client, async () => {
      let start = await nextInvoiceSequence(client);

      for (let attempt = 0; attempt < ALLOC_MAX_ATTEMPTS; attempt++) {
        const end = start + count - 1;
        if (end > NO_INVOICE_MAX) {
          throw new Error("Nomor invoice sudah penuh");
        }

        const numbers = Array.from({ length: count }, (_, i) =>
          formatNoInvoice(start + i)
        );

        const existing = await client.pembayaran.findMany({
          where: { noInvoice: { in: numbers } },
          select: { noInvoice: true },
          orderBy: { noInvoice: "desc" },
        });

        if (existing.length === 0) return numbers;

        const highest = existing.reduce(
          (max, row) => Math.max(max, parseNoInvoiceSequence(row.noInvoice)),
          start
        );
        start = highest + 1;
      }

      throw new Error("Gagal mengalokasi nomor invoice");
    });

  // Jika pemanggil sudah di dalam transaksi Prisma, pakai client itu.
  // Jika default prisma, bungkus transaksi pendek agar lock + baca konsisten.
  if (tx === prisma) {
    return prisma.$transaction((inner) => run(inner), {
      maxWait: 15_000,
      timeout: 30_000,
    });
  }
  return run(tx);
}

/** Satu nomor invoice baru. */
export async function allocateNoInvoiceForCreate(
  tx: Prisma.TransactionClient = prisma
): Promise<string> {
  const [n] = await allocateNoInvoiceBatch(1, tx);
  return n!;
}

export { isNoInvoiceUniqueViolation };
