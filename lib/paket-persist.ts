import {
  derivePaketHargaFromNominalInput,
  brutoTagihanDariDpp,
  paketBreakdownFromHargaDpp,
} from "@/lib/pembayaran-tax";

export type PaketNominalFields = {
  harga: number;
  nominalPembayaran?: number | null;
};

/** Server-side: nominal admin → harga DPP + nominal tersimpan. */
export function derivePaketPersistFromNominal(
  nominalInput: number,
  ppnPercent: number
): { harga: number; nominalPembayaran: number } {
  const { harga, nominal } = derivePaketHargaFromNominalInput(
    nominalInput,
    ppnPercent
  );
  return { harga, nominalPembayaran: nominal };
}

/**
 * Total tagihan baru dari paket — canonical untuk generate/backfill.
 * Fallback legacy hanya jika nominalPembayaran belum di-backfill.
 */
export function tagihanTotalFromPaket(
  paket: PaketNominalFields,
  ppnPercent: number
): number {
  if (
    paket.nominalPembayaran != null &&
    Number.isFinite(paket.nominalPembayaran)
  ) {
    return Math.round(Number(paket.nominalPembayaran));
  }
  return brutoTagihanDariDpp(Math.round(Number(paket.harga)), ppnPercent);
}

/** Nominal paket untuk tampilan UI (baca DB dulu, fallback heuristik pre-backfill). */
export function nominalPaketForDisplay(
  paket: PaketNominalFields,
  ppnPercent: number
): number {
  if (
    paket.nominalPembayaran != null &&
    Number.isFinite(paket.nominalPembayaran)
  ) {
    return Math.round(Number(paket.nominalPembayaran));
  }
  return paketBreakdownFromHargaDpp(
    Math.round(Number(paket.harga)),
    ppnPercent
  ).nominal;
}

/** PPN dari pecahan paket (display form). */
export function ppnFromPaketNominal(
  nominalPembayaran: number,
  hargaDpp: number
): number {
  return Math.round(Number(nominalPembayaran)) - Math.round(Number(hargaDpp));
}
