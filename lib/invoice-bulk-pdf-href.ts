/** URL helpers — safe to import from client components. */

export function bulkInvoicePdfQuery(ids: number[]): string {
  return ids.join(",");
}

export function pembayaranBulkInvoicePdfHref(ids: number[]): string {
  return `/api/pembayaran/invoice/bulk-pdf?id=${bulkInvoicePdfQuery(ids)}`;
}

export function pembayaranSingleInvoicePdfHref(pembayaranId: number): string {
  return pembayaranBulkInvoicePdfHref([pembayaranId]);
}

export function pembayaranBulkInvoicePdfHrefForMonth(
  mitraUserId: number,
  bulan: string
): string {
  const params = new URLSearchParams({
    mitraUserId: String(mitraUserId),
    bulan,
  });
  return `/api/pembayaran/invoice/bulk-pdf?${params.toString()}`;
}
