/** Bruto per baris, sama seperti `runGeneratePaymentsJob` (additive + bulatkan). */
export function brutoTagihanDariDpp(hargaDpp: number, ppnPercent: number): number {
  const rate = ppnPercent / 100;
  return Math.round(Number(hargaDpp) + Number(hargaDpp) * rate);
}

/** Parse komponen tanggal dari `jatuh_tempo` tanpa konversi timezone. */
export function parseJatuhTempoParts(jatuhTempo: string): {
  year: number;
  month: number;
  day: number;
} {
  const [year, month, day = 1] = jatuhTempo.split("-").map(Number);
  return { year, month, day };
}

/** DPP + PPN + nominal bruto dari harga paket (DPP → bruto, dipakai billing/generate tagihan). */
export function tagihanNominalDariPaket(
  hargaDpp: number,
  ppnPercent: number
): { harga: number; ppn: number; nominal: number } {
  const harga = Math.round(Number(hargaDpp));
  const nominal = brutoTagihanDariDpp(harga, ppnPercent);
  return { harga, ppn: nominal - harga, nominal };
}

/** Nominal input admin → pecahan paket (nominal = source of truth). */
export function derivePaketHargaFromNominalInput(
  brutoInput: number,
  ppnPercent: number
): { harga: number; ppn: number; nominal: number } {
  const nominal = Math.round(Number(brutoInput));
  if (nominal <= 0) return { harga: 0, ppn: 0, nominal: 0 };
  const harga = Math.round((nominal * 100) / (100 + ppnPercent));
  return { harga, ppn: nominal - harga, nominal };
}

/**
 * Pecahan paket dari harga DPP tersimpan (buka ulang form / tabel paket).
 * Inverse aturan input nominal: ambil nominal terbesar N dengan
 * round(N × 100 / (100+ppn)) === harga agar 495495 → 550000 (bukan 549999).
 */
export function paketBreakdownFromHargaDpp(
  hargaDpp: number,
  ppnPercent: number
): { harga: number; ppn: number; nominal: number } {
  const harga = Math.round(Number(hargaDpp));
  if (harga <= 0) return { harga: 0, ppn: 0, nominal: 0 };

  const denom = 100 + ppnPercent;
  let nominal = Math.round((harga * denom) / 100);
  if (Math.round((nominal * 100) / denom) !== harga) {
    if (Math.round(((nominal + 1) * 100) / denom) === harga) nominal += 1;
    else if (Math.round(((nominal - 1) * 100) / denom) === harga) nominal -= 1;
  }
  while (Math.round(((nominal + 1) * 100) / denom) === harga) {
    nominal += 1;
  }
  return { harga, ppn: nominal - harga, nominal };
}

/** Nominal paket untuk tampilan & sync tagihan saat edit paket (bukan generate job). */
export function nominalPaketDariHarga(
  hargaDpp: number,
  ppnPercent: number
): number {
  return paketBreakdownFromHargaDpp(hargaDpp, ppnPercent).nominal;
}

/** Bruto tagihan → DPP agar `brutoTagihanDariDpp` kembali persis ke bruto (billing / generate). */
export function dppDariBrutoTagihan(
  bruto: number,
  ppnPercent: number
): number {
  const target = Math.round(Number(bruto));
  if (target <= 0) return 0;
  const rate = ppnPercent / 100;
  const seed = Math.round(target / (1 + rate));
  for (let delta = -3; delta <= 3; delta++) {
    const candidate = Math.max(0, seed + delta);
    if (brutoTagihanDariDpp(candidate, ppnPercent) === target) {
      return candidate;
    }
  }
  return seed;
}

/**
 * Nominal PPN dari satu tagihan stored.
 * Prioritas: total tagihan − DPP paket (konsisten dengan Pembayaran.total).
 */
export function ppnNominalPerBaris(
  totalBruto: number,
  hargaPaketDpp: number,
  _ppnPercent?: number,
  _konsistenSlack?: number
): number {
  const gross = Math.round(Number(totalBruto));
  const dpp = Math.round(Number(hargaPaketDpp));
  if (gross >= dpp) return gross - dpp;
  return 0;
}
