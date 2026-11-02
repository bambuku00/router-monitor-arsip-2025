import { buildInvoiceHtml } from "../lib/invoice-html";
import { htmlToPdfBuffer } from "../lib/invoice-pdf";
import { resolveInvoiceHtmlAssets } from "../lib/invoice-resolve-assets";
import type { InvoiceData } from "../lib/invoice-data";

const sample: InvoiceData = {
  pembayaranId: 1,
  mitraUserId: 1,
  isPaid: false,
  noInvoice: "012345",
  barcodeText: "012345",
  tanggalInvoice: "01/05/2026",
  jatuhTempo: "20/05/2026",
  tanggalCetak: "30/05/2026",
  paketNama: "5Mbps",
  periodeAwal: "1 April 2026",
  periodeAkhir: "30 April 2026",
  pelanggan: {
    nama: "Test",
    alamat: "Alamat",
    telp: "081",
    noLayanan: "202605000001",
  },
  nominal: {
    hargaPaket: 150000,
    ppn: 16500,
    potongan: 0,
    totalAkhir: 166500,
  },
  terbilang: "seratus",
  caraBayar: null,
  channel: null,
  penerima: null,
  banks: [{ nama: "BCA", norek: "123", namaPemilik: "PT" }],
  settings: {
    logoSize: 200,
    logoUrl: "/x",
    qrUrl: "/x",
    bgUrl: "/x",
    logoFilename: null,
    qrFilename: null,
    bgFilename: null,
    bgWatermark: true,
    bgSizeMm: 220,
    bgOpacity: 40,
    companyName: "PT Test",
    companySlogan: "ISP",
    companyAddress1: "A",
    companyAddress2: "B",
    companyAddress3: "C",
    signatureName: "admin",
    signaturePosition: "Finance",
    cashPaymentNote: "tunai",
    confirmationNumber: "0822",
    paymentNotes: "catatan",
    tandaTerima: "tt",
    ucapanLunas: "thanks",
    footerText: "footer",
    ppnStatus: true,
    ppnValue: 11,
    ppnCalculationMode: "after",
    discountStatus: false,
    discountType: "fixed",
    discountValue: 0,
  },
};

async function main() {
  const assets = await resolveInvoiceHtmlAssets(
    1,
    sample.settings,
    sample.barcodeText
  );
  const html = buildInvoiceHtml(sample, assets);
  const pdf = await htmlToPdfBuffer(html);
  console.log("OK pdf bytes:", pdf.length);
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
