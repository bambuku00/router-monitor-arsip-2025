/** Pelanggan yang diisi lewat bulk "Isi data" di halaman PPP. */
export function isPelangganAutoFilled(
  pelanggan: { autoFilledAt?: Date | string | null } | null | undefined
): boolean {
  return pelanggan?.autoFilledAt != null;
}
