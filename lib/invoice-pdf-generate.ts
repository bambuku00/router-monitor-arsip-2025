import { getInvoiceData } from "@/lib/invoice-data";
import { buildInvoiceHtml } from "@/lib/invoice-html";
import { htmlToPdfBuffer } from "@/lib/invoice-pdf";
import { resolveInvoiceHtmlAssets } from "@/lib/invoice-resolve-assets";
import type { User } from "lucia";

export async function generateInvoicePdfForPembayaran(
  pembayaranId: number,
  user: User
): Promise<{ buffer: Buffer; filename: string } | null> {
  const data = await getInvoiceData(pembayaranId, user);
  if (!data) return null;

  const assets = await resolveInvoiceHtmlAssets(
    data.mitraUserId,
    data.settings,
    data.barcodeText
  );
  const html = buildInvoiceHtml(data, assets);
  const buffer = await htmlToPdfBuffer(html);
  const filename = `INV-${data.noInvoice}.pdf`;

  return { buffer, filename };
}
