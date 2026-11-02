/** Konstanta asset invoice — aman di client & server (tanpa node:path). */
export const INVOICE_DEFAULT_LOGO = "/invoice-defaults/logo.png";
export const INVOICE_DEFAULT_QR = "/invoice-defaults/qr-winet.png";
export const INVOICE_DEFAULT_BG = "/invoice-defaults/bg.png";

/** Sama apiwin edit_unpaid.php — slider ukuran logo (px). */
export const INVOICE_LOGO_SIZE_MIN = 1;
export const INVOICE_LOGO_SIZE_MAX = 200;
export const INVOICE_LOGO_SIZE_DEFAULT = 200;

export function clampInvoiceLogoSize(size: number) {
  return Math.min(
    INVOICE_LOGO_SIZE_MAX,
    Math.max(INVOICE_LOGO_SIZE_MIN, Math.round(size))
  );
}

/** Lebar area konten invoice (mm). */
export const INVOICE_BODY_WIDTH_MM = 170;
/** Lebar kertas A4 (mm) — watermark mengisi area ini. */
export const INVOICE_PAGE_WIDTH_MM = 210;

/** Lebar gambar watermark (mm), sama apiwin default 220mm > lebar kertas. */
export const INVOICE_BG_SIZE_MM_MIN = 80;
export const INVOICE_BG_SIZE_MM_MAX = 320;
export const INVOICE_BG_SIZE_MM_DEFAULT = 220;

/** Opacity watermark (%), tebal/tipis tampilan. */
export const INVOICE_BG_OPACITY_MIN = 5;
export const INVOICE_BG_OPACITY_MAX = 100;
export const INVOICE_BG_OPACITY_DEFAULT = 40;

export function clampInvoiceBgSizeMm(mm: number) {
  return Math.min(
    INVOICE_BG_SIZE_MM_MAX,
    Math.max(INVOICE_BG_SIZE_MM_MIN, Math.round(mm))
  );
}

export function clampInvoiceBgOpacity(pct: number) {
  return Math.min(
    INVOICE_BG_OPACITY_MAX,
    Math.max(INVOICE_BG_OPACITY_MIN, Math.round(pct))
  );
}

/** Lebar background watermark (mm) — nilai >210mm memenuhi pinggir kertas A4. */
export function invoiceBgSizeCss(sizeMm: number): string {
  return `${clampInvoiceBgSizeMm(sizeMm)}mm auto`;
}

/** Lebar lapisan watermark: minimal penuh A4, atau lebih lebar jika slider > 210mm. */
export function invoiceBgLayerWidthMm(sizeMm: number): number {
  return Math.max(INVOICE_PAGE_WIDTH_MM, clampInvoiceBgSizeMm(sizeMm));
}

export function invoiceBgOpacityCss(opacityPct: number): number {
  return clampInvoiceBgOpacity(opacityPct) / 100;
}

/** Tinggi area watermark (% dari body) — apiwin pakai 50%. */
export function invoiceBgWatermarkHeightPct(_sizeMm: number): number {
  return 50;
}
