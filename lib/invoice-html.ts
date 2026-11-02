import { formatInvoicePaketLabel, type InvoiceData } from "@/lib/invoice-data";
import {
  INVOICE_PAGE_WIDTH_MM,
  invoiceBgLayerWidthMm,
  invoiceBgOpacityCss,
  invoiceBgSizeCss,
  invoiceBgWatermarkHeightPct,
} from "@/lib/invoice-assets";

export type InvoiceHtmlAssets = {
  logoSrc: string;
  qrSrc: string;
  bgSrc: string | null;
  barcodeSrc: string;
};

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmt(n: number) {
  return n.toLocaleString("id-ID");
}

function invoiceLabel(noInvoice: string) {
  const trimmed = noInvoice.trim();
  if (/^inv[\s-]/i.test(trimmed)) return trimmed;
  return `INV ${trimmed}`;
}

function companyAddressHtml(a1: string, a2: string, a3: string): string {
  const lines = [a1, a2, a3].map((s) => s.trim()).filter(Boolean);
  if (lines.length === 0) return "";
  const [first, ...rest] = lines;
  const parts = [`<span class="company-address-line1">${esc(first)}</span>`];
  for (const line of rest) {
    parts.push(esc(line));
  }
  return parts.join("<br>");
}

/** CSS 1:1 dari apiwin template_paid / template_unpaid (+ penyesuaian logo & slogan). */
function invoiceCss(
  isPaid: boolean,
  bgSrc: string | null,
  logoSize: number,
  bgSizeMm: number,
  bgOpacity: number
) {
  const companyOffset = Math.max(410, logoSize + 32);
  const headerMinHeight = Math.max(72, logoSize + 28);
  const bgLayerWidthMm = invoiceBgLayerWidthMm(bgSizeMm);
  const watermark = bgSrc
    ? `
    .invoice-page::before {
        content: '';
        position: absolute;
        top: 0;
        left: 50%;
        transform: translateX(-50%);
        width: ${bgLayerWidthMm}mm;
        height: ${invoiceBgWatermarkHeightPct(bgSizeMm)}%;
        background-image: url('${bgSrc}');
        background-size: ${invoiceBgSizeCss(bgSizeMm)};
        background-position: top center;
        background-repeat: no-repeat;
        opacity: ${invoiceBgOpacityCss(bgOpacity)};
        z-index: 0;
        pointer-events: none;
    }
    .invoice-page > * {
        position: relative;
        z-index: 1;
    }
  `
    : "";

  const statusColor = isPaid ? "green" : "red";
  const customerFontSize = "12px";

  return `
    @page { size: A4; margin: 0; }

    html {
        margin: 0;
        padding: 0;
        min-height: 100%;
        background: #fff;
    }

    body {
        font-family: Arial, sans-serif;
        margin: 0;
        padding: 0;
        font-size: 13px;
        color: #000;
        background: #fff;
    }

    .invoice-page {
        position: relative;
        margin: 0 auto;
        padding: 20px;
        width: 170mm;
        max-width: 100%;
        min-height: 257mm;
        background-color: ${bgSrc ? "transparent" : "white"};
        page-break-after: always;
        break-after: page;
    }
    .invoice-page:last-child {
        page-break-after: auto;
        break-after: auto;
    }
    ${watermark}

    @media print {
        * { print-color-adjust: exact !important; -webkit-print-color-adjust: exact !important; }
        .invoice-details {
            border: 1px solid #000 !important;
        }
        .invoice-details td {
            border: 1px solid #000 !important;
            background-color: inherit !important;
        }
        .table th, .table td {
            border: 1px solid #000 !important;
            background-color: inherit !important;
        }
        .table th {
            background-color: #999595 !important;
            print-color-adjust: exact !important;
        }
        .invoice-details tr:nth-child(even) { background-color: #e6f3ff !important; }
        .invoice-details tr:first-child { background-color: #b3d9ff !important; }
        .table tbody tr:nth-child(odd) { background-color: #f2f2f2 !important; }
        html { margin: 0; padding: 0; }
        .invoice-page::before {
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
        }
        .invoice-page {
            background-color: ${bgSrc ? "transparent" : "white"} !important;
            margin: 0 auto !important;
            padding: 20px !important;
            width: 170mm !important;
            min-height: auto !important;
            height: auto !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        body {
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    .header {
        position: relative;
        min-height: ${headerMinHeight}px;
        margin-bottom: 15px;
        margin-top: 20px;
    }
    .logo {
        position: absolute;
        left: 0;
        top: 20px;
        z-index: 1;
        width: ${logoSize}px;
    }
    .logo img {
        display: block;
        height: auto;
        max-width: none;
    }
    .company-info {
        position: absolute;
        left: ${companyOffset}px;
        top: 20px;
        text-align: left;
        font-size: 12px;
    }
    .company-info h3, .company-info h4 { margin: 3px 0; }
    .company-info h3 { font-weight: bold; font-size: 16px; line-height: 1.25; white-space: nowrap; }
    .company-info h4 {
        font-weight: 600;
        font-size: 14px;
        text-align: left;
        margin-bottom: 5px;
        line-height: 1.25;
    }
    .company-info p {
        font-size: 12px;
        line-height: 1.4;
        margin: 0;
    }
    .company-info .company-address-line1 {
        white-space: nowrap;
        display: inline-block;
    }

    .status-invoice {
        text-align: right;
        color: ${statusColor};
        font-weight: bold;
        margin-bottom: 0;
        font-size: 20px;
        margin-top: -50px;
        margin-right: 2px;
        line-height: 1.2;
    }
    .invoice-details {
        border-collapse: collapse;
        width: 195px;
        margin-top: 2px;
        margin-left: auto;
        margin-right: 0;
        border: 1px solid #000;
    }
    .content-wrapper {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-top: 0;
        margin-bottom: 0;
        gap: 10px;
        overflow: visible;
    }
    .customer-info {
        text-align: left;
        width: 300px;
        margin-top: 0;
        margin-bottom: 0;
        font-size: ${customerFontSize};
        line-height: 1.3;
        word-wrap: break-word;
    }
    .customer-info b {
        font-size: ${customerFontSize};
        font-weight: bold;
    }
    .invoice-wrapper {
        text-align: right;
        width: 230px;
        flex-shrink: 0;
        margin-top: 0;
        padding-right: 1px;
        overflow: visible;
    }
    .barcode-container {
        margin-top: 4px;
        margin-bottom: 0;
    }
    .barcode {
        text-align: right;
        margin-top: 0;
        margin-right: 2px;
    }
    .barcode img {
        width: 194px;
        height: 25px;
    }

    .invoice-details td {
        border: 1px solid #000;
        padding: 3px 10px;
        font-size: 12px;
    }
    .invoice-details tr td:last-child {
        border-right: 1px solid #000;
    }
    .invoice-details tr:nth-child(even) { background-color: #e6f3ff; }
    .invoice-details tr:first-child { background-color: #b3d9ff; }

    .table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 4px;
    }
    .table th, .table td {
        border: 1px solid black;
        padding: 5px;
        font-size: 12px;
    }
    .table th { background-color: #999595; }
    .table tbody tr:nth-child(odd) { background-color: #f2f2f2; }
    .table thead tr { background-color: #e6e6e6; }

    .ringkasan-tagihan {
        margin: 0;
        padding: 0;
    }
    .payment-info { margin-top: 0; }
  `;
}

function unpaidPaymentBlock(data: InvoiceData) {
  const notes = data.settings.paymentNotes
    .split("\n")
    .filter(Boolean)
    .map((line) => `<div>${esc(line)}</div>`)
    .join("");

  const banks =
    data.banks.length === 0
      ? "<div>Tidak ada data bank yang aktif.</div>"
      : data.banks
          .map(
            (b) =>
              `<div>${esc(b.nama)} ${esc(b.norek)} ${esc(b.namaPemilik)}</div>`
          )
          .join("");

  return `
        <div class="payment-info">
            <div style="border-bottom: 1px solid #000; font-weight: bold;">CARA PEMBAYARAN</div>
            <div style="margin-top: 10px;">
                <div style="font-weight: bold;">TUNAI</div>
                <div>${esc(data.settings.cashPaymentNote)}</div>
            </div>
            <div style="margin-top: 10px;">
                <div style="font-weight: bold;">TRANSFER BANK</div>
                ${banks}
            </div>
            <div style="margin-top: 10px;">
                <div style="border-bottom: 1px solid #000; font-weight: bold;">KONFIRMASI</div>
                <div>${esc(data.settings.confirmationNumber)}</div>
            </div>
            <div style="margin-top: 10px;">
                <div style="border-bottom: 1px solid #000; font-weight: bold;">CATATAN</div>
                ${notes}
            </div>
        </div>`;
}

function paidPaymentBlock(data: InvoiceData) {
  return `
            <div style="margin-top: 10px;">
                <div style="margin-top: 10px;"><b>CARA PEMBAYARAN : ${esc(data.caraBayar ?? "-")}</b></div>
                <div style="margin-top: 10px;"><b>CHANNEL : ${esc(data.channel ?? "-")}</b></div>
                <div style="margin-top: 10px;"><b>ADMIN : ${esc(data.penerima ?? "-")}</b></div>
            </div>
            <div style="margin-top: 10px;">
                <div style="border-bottom: 1px solid #000; font-weight: bold;"></div>
                <div style="margin-top: 10px;">${esc(data.settings.ucapanLunas)}</div>
                <div style="margin-top: 10px;">${esc(data.settings.tandaTerima)}</div>
            </div>`;
}

function wrapInvoiceHtmlDocument(
  title: string,
  css: string,
  bodyHtml: string
): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=${Math.round((INVOICE_PAGE_WIDTH_MM * 96) / 25.4)}, initial-scale=1"/>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
<title>${esc(title)}</title>
<style>${css}</style>
</head>
<body>${bodyHtml}</body>
</html>`;
}

export function buildInvoiceBodyHtml(
  data: InvoiceData,
  assets: InvoiceHtmlAssets
): string {
  const { settings, nominal, isPaid } = data;
  const terbilang =
    data.terbilang.charAt(0).toUpperCase() + data.terbilang.slice(1);
  const qrSize = isPaid ? 100 : 80;
  const statusLabel = isPaid ? "SUDAH LUNAS" : "BELUM LUNAS";
  const statusColor = isPaid ? "green" : "red";

  const discountRow = settings.discountStatus
    ? `<tr>
                    <td style="text-align: right;">
                        DISKON${
                          settings.discountType === "percentage"
                            ? ` (${settings.discountValue}%)`
                            : ""
                        }
                    </td>
                    <td style="text-align: right;">${fmt(nominal.potongan)}</td>
                </tr>`
    : "";

  const ppnRow =
    settings.ppnStatus && nominal.ppn > 0
      ? `<tr>
                    <td style="text-align: right;">PPN ${settings.ppnValue}%</td>
                    <td style="text-align: right;">${fmt(nominal.ppn)}</td>
                </tr>`
      : "";

  const bodyInner = `
        <div class="header">
            <div class="logo">
                <img src="${assets.logoSrc}" style="width: ${settings.logoSize}px;" alt="Logo">
            </div>
            <div class="company-info">
                <h3>${esc(settings.companyName)}</h3>
                <h4>${esc(settings.companySlogan)}</h4>
                <p>${companyAddressHtml(settings.companyAddress1, settings.companyAddress2, settings.companyAddress3)}</p>
            </div>
        </div>

        <div class="content-wrapper">
            <div class="customer-info">
                Kepada Yth<br><br>
                <b>${esc(data.pelanggan.nama)}</b><br>
                ${esc(data.pelanggan.alamat)}<br>
                ${esc(data.pelanggan.telp)}<br>
                NO. LAYANAN ${esc(data.pelanggan.noLayanan)}
            </div>
            <div class="invoice-wrapper">
                <div class="status-invoice" style="color: ${statusColor};">${statusLabel}</div>
                <div class="barcode-container">
                    <div class="barcode">
                        <img src="${assets.barcodeSrc}" alt="Barcode">
                    </div>
                </div>
                <table class="invoice-details">
                    <tr>
                        <td colspan="2" style="text-align: center; font-weight: bold; font-size: 20px;">
                            <b>${esc(invoiceLabel(data.noInvoice))}</b>
                        </td>
                    </tr>
                    <tr>
                        <td>Tanggal invoice</td>
                        <td>${esc(data.tanggalInvoice)}</td>
                    </tr>
                    <tr>
                        <td>Jatuh tempo</td>
                        <td>${esc(data.jatuhTempo)}</td>
                    </tr>
                    <tr>
                        <td>Tanggal cetak</td>
                        <td>${esc(data.tanggalCetak)}</td>
                    </tr>
                </table>
            </div>
        </div>

        <div class="ringkasan-tagihan"></div>

        <table class="table">
            <thead>
                <tr>
                    <th>RINGKASAN TAGIHAN</th>
                    <th style="width: 150px;">JUMLAH</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>${esc(formatInvoicePaketLabel(data.paketNama))} (${esc(data.periodeAwal)} - ${esc(data.periodeAkhir)})</td>
                    <td style="text-align: right;">${fmt(nominal.hargaPaket)}</td>
                </tr>
                <tr>
                    <td style="text-align: right;">SUB TOTAL</td>
                    <td style="text-align: right;">${fmt(nominal.hargaPaket)}</td>
                </tr>
                ${ppnRow}
                ${discountRow}
                <tr>
                    <td style="text-align: right; font-weight: bold;">TOTAL TAGIHAN</td>
                    <td style="text-align: right; font-weight: bold;">${fmt(nominal.totalAkhir)}</td>
                </tr>
            </tbody>
        </table>

        <div style="margin-top: 10px; text-align: right; font-style: italic;">
            <b>Terbilang : ${esc(terbilang)} rupiah</b>
        </div>

        ${isPaid ? paidPaymentBlock(data) : unpaidPaymentBlock(data)}

        <div style="margin-top: 30px; text-align: right;">
            <div>${esc(settings.companyName)}</div><br>
            <img src="${assets.qrSrc}" width="${qrSize}" height="${qrSize}" style="display: inline-block;" alt="QR">
            <div style="border-bottom: 1px solid #000; width: 40px; margin-left: auto; margin-top: 15px;">
                ${esc(settings.signaturePosition)}
            </div>
            <div>${esc(settings.signatureName)}</div>
            <div style="margin-top: 90px; text-align: center;">${esc(settings.footerText)}</div>
        </div>`;
  return bodyInner;
}

export function buildInvoiceHtml(
  data: InvoiceData,
  assets: InvoiceHtmlAssets
): string {
  const { settings, isPaid } = data;
  const bgSrc = settings.bgWatermark ? assets.bgSrc : null;
  const bodyInner = buildInvoiceBodyHtml(data, assets);
  const css = invoiceCss(
    isPaid,
    bgSrc,
    settings.logoSize,
    settings.bgSizeMm,
    settings.bgOpacity
  );
  return wrapInvoiceHtmlDocument(
    `Invoice ${data.noInvoice}`,
    css,
    `<div class="invoice-page">${bodyInner}</div>`
  );
}

/** Beberapa invoice dalam satu dokumen (seperti apiwin unpaid.php?id=1,2,3). */
export function buildCombinedInvoicesHtml(
  pages: { data: InvoiceData; assets: InvoiceHtmlAssets }[]
): string {
  if (pages.length === 0) {
    throw new Error("Tidak ada invoice untuk dicetak");
  }
  if (pages.length === 1) {
    return buildInvoiceHtml(pages[0]!.data, pages[0]!.assets);
  }

  const lead = pages[0]!;
  const { settings } = lead.data;
  const bgSrc = settings.bgWatermark ? lead.assets.bgSrc : null;
  const css = invoiceCss(
    false,
    bgSrc,
    settings.logoSize,
    settings.bgSizeMm,
    settings.bgOpacity
  );
  const bodyHtml = pages
    .map(
      (p) =>
        `<div class="invoice-page">${buildInvoiceBodyHtml(p.data, p.assets)}</div>`
    )
    .join("\n");
  const title = pages.map((p) => p.data.noInvoice).join(", ");
  return wrapInvoiceHtmlDocument(`Invoice ${title}`, css, bodyHtml);
}
