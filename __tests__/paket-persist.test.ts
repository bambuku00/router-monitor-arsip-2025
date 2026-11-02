import { describe, expect, it } from "vitest";

import { computeInvoiceNominal } from "@/lib/invoice-data";
import type { InvoiceSettingsDto } from "@/lib/invoice-settings";
import {
  nominalPaketForDisplay,
  tagihanTotalFromPaket,
} from "@/lib/paket-persist";
import { ppnNominalPerBaris } from "@/lib/pembayaran-tax";

function invoiceSettingsFixture(
  overrides: Partial<InvoiceSettingsDto> = {}
): InvoiceSettingsDto {
  return {
    logoSize: 200,
    logoUrl: "",
    qrUrl: "",
    bgUrl: "",
    logoFilename: null,
    qrFilename: null,
    bgFilename: null,
    bgWatermark: true,
    bgSizeMm: 220,
    bgOpacity: 40,
    companyName: "",
    companySlogan: "",
    companyAddress1: "",
    companyAddress2: "",
    companyAddress3: "",
    signatureName: "",
    signaturePosition: "",
    cashPaymentNote: "",
    confirmationNumber: "",
    paymentNotes: "",
    tandaTerima: "",
    ucapanLunas: "",
    footerText: "",
    ppnStatus: true,
    ppnValue: 11,
    ppnCalculationMode: "after",
    discountStatus: false,
    discountType: "fixed",
    discountValue: 0,
    ...overrides,
  };
}

describe("paket-persist billing source of truth", () => {
  const ppn = 11;

  it("tagihanTotalFromPaket uses nominalPembayaran when set", () => {
    const paket = { harga: 495_495, nominalPembayaran: 550_000 };
    expect(tagihanTotalFromPaket(paket, ppn)).toBe(550_000);
  });

  it("tagihanTotalFromPaket falls back to legacy bruto when nominal null", () => {
    const paket = { harga: 495_495, nominalPembayaran: null };
    expect(tagihanTotalFromPaket(paket, ppn)).toBe(549_999);
  });

  it("nominalPaketForDisplay prefers DB nominal over heuristic", () => {
    expect(
      nominalPaketForDisplay({ harga: 495_495, nominalPembayaran: 550_000 }, ppn)
    ).toBe(550_000);
    expect(
      nominalPaketForDisplay({ harga: 495_495, nominalPembayaran: null }, ppn)
    ).toBe(550_000);
  });

  it("invoice uses Pembayaran.total for PPN breakdown (550000 case)", () => {
    const settings = invoiceSettingsFixture({
      ppnStatus: true,
      ppnValue: ppn,
      ppnCalculationMode: "after",
      discountStatus: false,
      discountType: "percentage",
      discountValue: 0,
    });
    const nominal = computeInvoiceNominal(495_495, settings, 550_000);
    expect(nominal.totalAkhir).toBe(550_000);
    expect(nominal.hargaPaket).toBe(495_495);
    expect(nominal.ppn).toBe(54_505);
  });

  it("invoice without PPN shows full package nominal (not DPP)", () => {
    const settings = invoiceSettingsFixture({
      ppnStatus: false,
      ppnValue: ppn,
      ppnCalculationMode: "after",
      discountStatus: false,
      discountType: "percentage",
      discountValue: 0,
    });
    // Input cetak = nominal penuh (mis. 300.000), bukan DPP 270.270.
    const nominal = computeInvoiceNominal(300_000, settings, 300_000);
    expect(nominal.hargaPaket).toBe(300_000);
    expect(nominal.ppn).toBe(0);
    expect(nominal.totalAkhir).toBe(300_000);
  });

  it("kuitansi PPN from stored total — histori 549999 tetap 549999", () => {
    const dpp = 495_495;
    const historiTotal = 549_999;
    expect(ppnNominalPerBaris(historiTotal, dpp, ppn)).toBe(54_504);
    expect(historiTotal).toBe(549_999);
  });

  it("kuitansi PPN from new tagihan 550000", () => {
    expect(ppnNominalPerBaris(550_000, 495_495, ppn)).toBe(54_505);
  });
});
