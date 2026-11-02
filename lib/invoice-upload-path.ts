import path from "node:path";

export { INVOICE_DEFAULT_LOGO, INVOICE_DEFAULT_QR, INVOICE_DEFAULT_BG } from "@/lib/invoice-assets";

export const INVOICE_UPLOAD_DIR = path.join(process.cwd(), "uploads", "invoice");

export function invoiceUploadDirForUser(userId: number) {
  return path.join(INVOICE_UPLOAD_DIR, String(userId));
}

export function isSafeInvoiceUploadFilename(name: string) {
  return /^[a-zA-Z0-9._-]+\.(png|jpg|jpeg|webp)$/i.test(name);
}
