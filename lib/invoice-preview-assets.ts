import type { InvoiceSettingsDto } from "@/lib/invoice-settings";
import {
  INVOICE_DEFAULT_BG,
  INVOICE_DEFAULT_LOGO,
  INVOICE_DEFAULT_QR,
} from "@/lib/invoice-assets";
import type { InvoiceHtmlAssets } from "@/lib/invoice-html";

function toAbsoluteAssetUrl(origin: string, url: string) {
  if (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("blob:") ||
    url.startsWith("data:")
  ) {
    return url;
  }
  return `${origin}${url.startsWith("/") ? url : `/${url}`}`;
}

/** URL absolut untuk preview iframe di browser (client-safe). */
export function resolveInvoiceHtmlAssetsFromUrls(
  origin: string,
  settings: InvoiceSettingsDto,
  barcodeSrc: string
): InvoiceHtmlAssets {
  return {
    logoSrc: toAbsoluteAssetUrl(
      origin,
      settings.logoUrl || INVOICE_DEFAULT_LOGO
    ),
    qrSrc: toAbsoluteAssetUrl(origin, settings.qrUrl || INVOICE_DEFAULT_QR),
    bgSrc: settings.bgWatermark
      ? toAbsoluteAssetUrl(origin, settings.bgUrl || INVOICE_DEFAULT_BG)
      : null,
    barcodeSrc,
  };
}
