/**
 * Pembagian pendapatan bersih setelah PPN & BHP/USO: mitra dapat `omsetMitraPercent`%
 * dari bersih, kantor sisanya (bagian mitra dibulatkan dulu).
 *
 * `omsetMitraPercent` mengikuti field User.omset (% untuk mitra, 0–100).
 * Jika null atau undefined, pakai 50 (bagi dua sama seperti perilaku lama).
 */
export function bagiPendapatanBersihMitraKantor(
  bersih: number,
  omsetMitraPercent?: number | null,
  revenueShareEnabled: boolean = true
): {
  mitra: number;
  kantor: number;
} {
  const n = Number(bersih);
  const amount = Number.isFinite(n) ? n : 0;
  if (!revenueShareEnabled) {
    return { mitra: Math.round(amount), kantor: 0 };
  }
  const raw =
    omsetMitraPercent == null || Number.isNaN(Number(omsetMitraPercent))
      ? 50
      : Number(omsetMitraPercent);
  const pct = Math.min(100, Math.max(0, raw));
  const mitra = Math.round((amount * pct) / 100);
  return { mitra, kantor: amount - mitra };
}
