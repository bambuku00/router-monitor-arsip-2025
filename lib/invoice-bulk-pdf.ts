import { getInvoiceData } from "@/lib/invoice-data";
import { buildCombinedInvoicesHtml } from "@/lib/invoice-html";
import { htmlToPdfBuffer } from "@/lib/invoice-pdf";
import { resolveInvoiceHtmlAssets } from "@/lib/invoice-resolve-assets";
import { monthJatuhTempoRange } from "@/lib/billing-due-date";
import { pelangganUntukPenagihanWhere } from "@/lib/pembayaran-pelanggan-scope";
import prisma from "@/lib/prisma";
import { resolveStaffPelangganScopeWhere } from "@/lib/staff-pelanggan-scope";
import type { User } from "lucia";

export const MAX_BULK_INVOICE_PDF = 150;
export const BULK_INVOICE_PREP_CONCURRENCY = 8;

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function worker() {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) break;
      results[index] = await fn(items[index]!, index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker())
  );
  return results;
}

export async function resolveBulkInvoicePembayaranIds(
  user: User,
  opts: { ids?: number[]; mitraUserId?: number; bulan?: string }
): Promise<number[]> {
  if (opts.ids?.length) {
    return [...new Set(opts.ids.filter((id) => Number.isInteger(id) && id > 0))];
  }

  if (opts.mitraUserId == null || !opts.bulan?.trim()) {
    throw new Error("Pilih tagihan atau tentukan mitra dan bulan");
  }

  const mitraUserId = opts.mitraUserId;
  if (
    user.role !== "Superadmin" &&
    user.id !== mitraUserId &&
    user.parentId !== mitraUserId
  ) {
    throw new Error("Akses ditolak");
  }

  const bulan = opts.bulan.trim();
  if (!/^\d{4}-\d{2}$/.test(bulan)) {
    throw new Error("Format bulan tidak valid");
  }

  const routerRows = await prisma.router.findMany({
    where: { userId: mitraUserId, deleted: false },
    select: { id: true },
  });
  const routerIds = routerRows.map((r) => r.id);
  if (routerIds.length === 0) return [];

  const staffPelangganWhere = await resolveStaffPelangganScopeWhere(
    user,
    mitraUserId,
    null
  );

  const rows = await prisma.pembayaran.findMany({
    where: {
      nonaktif: false,
      jatuh_tempo: monthJatuhTempoRange(bulan),
      pelanggan: {
        routerId: { in: routerIds },
        ...pelangganUntukPenagihanWhere,
        ...staffPelangganWhere,
      },
    },
    select: { id: true },
    orderBy: { id: "asc" },
  });

  return rows.map((r) => r.id);
}

/** Satu PDF berisi banyak halaman invoice (apiwin unpaid.php?id=1,2,3). */
export async function buildBulkInvoicePdf(
  user: User,
  pembayaranIds: number[]
): Promise<{ buffer: Buffer; count: number; pdfName: string }> {
  const unique = [...new Set(pembayaranIds)];
  if (unique.length === 0) {
    throw new Error("Tidak ada tagihan untuk dicetak");
  }
  if (unique.length > MAX_BULK_INVOICE_PDF) {
    throw new Error(
      `Maksimal ${MAX_BULK_INVOICE_PDF} invoice per cetak. Kurangi pilihan atau gunakan filter.`
    );
  }

  const prepared = await mapWithConcurrency(
    unique,
    BULK_INVOICE_PREP_CONCURRENCY,
    async (pembayaranId) => {
      const data = await getInvoiceData(pembayaranId, user);
      if (!data) return null;
      const assets = await resolveInvoiceHtmlAssets(
        data.mitraUserId,
        data.settings,
        data.barcodeText
      );
      return { pembayaranId, data, assets };
    }
  );

  const pages = prepared.filter(
    (row): row is NonNullable<typeof row> => row != null
  );
  if (pages.length === 0) {
    throw new Error("Tidak ada invoice yang berhasil disiapkan");
  }

  const failed = unique.filter(
    (id) => !pages.some((p) => p.pembayaranId === id)
  );
  if (failed.length > 0) {
    console.warn("Bulk invoice skipped ids:", failed);
  }

  const html = buildCombinedInvoicesHtml(pages);
  const buffer = await htmlToPdfBuffer(html);
  const stamp = new Date().toISOString().slice(0, 10);
  const pdfName =
    pages.length === 1
      ? `INV-${pages[0]!.data.noInvoice}.pdf`
      : `invoice-${stamp}-${pages.length}.pdf`;

  return { buffer, count: pages.length, pdfName };
}
