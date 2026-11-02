/** Teks konfirmasi hapus router (dipakai tombol utama & menu ⋯). */
export function routerDeleteConfirmText(namaRouter: string): string {
  return `Hapus router "${namaRouter}"?\n\nPelanggan, PPPoE, pembayaran, dan sinkron PPP untuk router ini akan ikut dihapus dari aplikasi. Pastikan tidak ada lagi tagihan yang harus dipertahankan.`;
}

/** Memanggil DELETE /api/router/:id — lempar Error jika gagal. Mengembalikan pesan sukses. */
export async function fetchDeleteRouter(routerId: number): Promise<string> {
  const resp = await fetch(`/api/router/${routerId}`, { method: "DELETE" });
  const json = await resp.json().catch(() => ({} as Record<string, unknown>));
  if (!resp.ok) {
    const errMsg =
      typeof json.error === "string"
        ? json.error
        : typeof json.message === "string"
          ? json.message
          : "Gagal menghapus router";
    throw new Error(errMsg);
  }
  return typeof json.message === "string" ? json.message : "Router berhasil dihapus";
}
