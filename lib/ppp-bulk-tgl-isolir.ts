import prisma from "@/lib/prisma";
import { getStaffPelangganScopeWhere } from "@/lib/staff-pelanggan-scope";
import type { User } from "lucia";

/** Hari bulan tagihan auto isolir. 31 tidak dipakai karena tidak ada di setiap bulan. */
export function assertTglIsolirDay(day: number): number {
  if (!Number.isInteger(day) || day < 1 || day > 30) {
    throw new Error("Tanggal isolir harus antara 1 dan 30");
  }
  return day;
}

/**
 * Set `tgl_isolir` yang sama untuk semua pelanggan di router.
 * Staff dengan batas pelanggan hanya mengubah pelanggan dalam scope-nya.
 */
export async function bulkSetPelangganTglIsolir(
  routerId: number,
  user: Pick<User, "id" | "role">,
  tglIsolir: number
): Promise<{ updated: number }> {
  const day = assertTglIsolirDay(tglIsolir);
  const scope = await getStaffPelangganScopeWhere(user);
  const result = await prisma.pelanggan.updateMany({
    where: { routerId, ...scope },
    data: { tgl_isolir: day },
  });
  return { updated: result.count };
}
