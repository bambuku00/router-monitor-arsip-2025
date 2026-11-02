/** Pelanggan gratis = flag eksplisit atau paket harga 0 (perilaku lama). */
export function isPaketGratisByHarga(harga: number): boolean {
  return Math.round(Number(harga)) <= 0;
}

export function isPelangganGratis(pel: {
  isFreeCustomer?: boolean;
  paket?: { harga: number };
}): boolean {
  if (pel.isFreeCustomer === true) return true;
  if (pel.paket != null && isPaketGratisByHarga(pel.paket.harga)) return true;
  return false;
}

export function resolveIsFreeCustomerForPaket(paketHarga: number): boolean {
  return isPaketGratisByHarga(paketHarga);
}
