import { describe, expect, it } from "vitest";

import {
  brutoTagihanDariDpp,
  derivePaketHargaFromNominalInput,
  dppDariBrutoTagihan,
  nominalPaketDariHarga,
  paketBreakdownFromHargaDpp,
  tagihanNominalDariPaket,
} from "@/lib/pembayaran-tax";

describe("pembayaran-tax paket nominal", () => {
  const ppn = 11;

  it("bruto 5.500.000 tetap konsisten (bukan 5.499.999 dari float)", () => {
    const bruto = 5_500_000;
    const dpp = dppDariBrutoTagihan(bruto, ppn);
    expect(dpp).toBe(4_954_955);
    expect(brutoTagihanDariDpp(dpp, ppn)).toBe(5_500_000);
    expect(tagihanNominalDariPaket(dpp, ppn).nominal).toBe(5_500_000);
  });

  it("bruto 100.000 tetap konsisten", () => {
    const bruto = 100_000;
    const dpp = dppDariBrutoTagihan(bruto, ppn);
    expect(brutoTagihanDariDpp(dpp, ppn)).toBe(100_000);
  });

  it("nominal input 550.000 → harga 495495, ppn 54505, total 550000", () => {
    const input = derivePaketHargaFromNominalInput(550_000, ppn);
    expect(input.nominal).toBe(550_000);
    expect(input.harga).toBe(495_495);
    expect(input.ppn).toBe(54_505);
    expect(input.harga + input.ppn).toBe(550_000);
    // DPP lain (495505) menghasilkan bruto tagihan 550011 — jangan dipakai untuk input user
    expect(brutoTagihanDariDpp(495_505, ppn)).toBe(550_011);
  });

  it("round-trip: harga tersimpan 495495 → nominal 550000 saat buka ulang", () => {
    const breakdown = paketBreakdownFromHargaDpp(495_495, ppn);
    expect(breakdown.harga).toBe(495_495);
    expect(breakdown.ppn).toBe(54_505);
    expect(breakdown.nominal).toBe(550_000);
    expect(breakdown.harga + breakdown.ppn).toBe(breakdown.nominal);
    expect(nominalPaketDariHarga(495_495, ppn)).toBe(550_000);
    // billing/generate masih pakai brutoTagihanDariDpp (549999) — beda aturan
    expect(brutoTagihanDariDpp(495_495, ppn)).toBe(549_999);
  });

  it.each([
    [550_000, 495_495, 54_505],
    [1_000_000, 900_901, 99_099],
    [333_333, 300_300, 33_033],
    [99_999, 90_089, 9_910],
    [5_500_000, 4_954_955, 545_045],
  ])(
    "nominal %i → harga %i + ppn %i = nominal (invariant)",
    (nominal, harga, ppnAmt) => {
      const fromInput = derivePaketHargaFromNominalInput(nominal, ppn);
      expect(fromInput).toEqual({ harga, ppn: ppnAmt, nominal });
      expect(fromInput.harga + fromInput.ppn).toBe(nominal);

      const fromHarga = paketBreakdownFromHargaDpp(harga, ppn);
      expect(fromHarga).toEqual({ harga, ppn: ppnAmt, nominal });
      expect(fromHarga.harga + fromHarga.ppn).toBe(nominal);
    }
  );

  it("avoid raw float multiply for display", () => {
    const dpp = 4_954_955;
    expect(dpp * 1.11).not.toBe(5_500_000);
    expect(brutoTagihanDariDpp(dpp, 11)).toBe(5_500_000);
  });
});
