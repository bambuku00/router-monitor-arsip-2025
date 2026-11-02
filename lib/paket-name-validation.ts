import { normalizePaketProfileName } from "@/lib/ppp-bulk-fill-resolve-paket";
import prisma from "@/lib/prisma";

export { normalizePaketProfileName as normalizePaketName };

export const DUPLICATE_PAKET_NAME_MESSAGE =
  "Nama paket sudah digunakan (tidak membedakan huruf besar/kecil). Gunakan nama yang unik.";

/** Cek konflik nama paket aktif pada owner yang sama (case-insensitive, trim). */
export async function findActivePaketNameConflict(params: {
  userId: number;
  nama: string;
  excludePaketId?: number;
}): Promise<boolean> {
  const target = normalizePaketProfileName(params.nama);
  const rows = await prisma.paket.findMany({
    where: {
      userId: params.userId,
      deleted: false,
      ...(params.excludePaketId != null
        ? { id: { not: params.excludePaketId } }
        : {}),
    },
    select: { nama: true },
  });
  return rows.some((r) => normalizePaketProfileName(r.nama) === target);
}
