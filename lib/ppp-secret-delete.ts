import type { PppSecret } from "@prisma/client";
import prisma from "@/lib/prisma";

export type DeletePppSecretOutcome = { ok: true } | { ok: false; error: string };

/**
 * Hapus baris PPP di aplikasi saja. Untuk menghapus secret di Mikrotik gunakan
 * halaman /tools/mikrotik (bukan dari sini).
 */
async function deletePppSecretFromDb(
  secretId: number,
  routerId: number,
  name: string
) {
  await prisma.pppActive.deleteMany({
    where: { routerId, name },
  });
  await prisma.pelanggan.updateMany({
    where: { ppp_secretId: secretId },
    data: {
      ppp_secretId: null,
      stop: true,
    },
  });
  await prisma.pppSecret.delete({
    where: { id: secretId },
  });
}

export async function deletePppSecretEntity(
  pppSecret: PppSecret
): Promise<DeletePppSecretOutcome> {
  try {
    await deletePppSecretFromDb(
      pppSecret.id,
      pppSecret.routerId,
      pppSecret.name
    );
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }

  return { ok: true };
}

export type BulkDeletePppRow = Pick<PppSecret, "id" | "routerId" | "name">;

/**
 * Hanya database. Penghapusan di Mikrotik: /tools/mikrotik.
 */
export async function bulkDeletePppSecretsOnSameRouter(
  secrets: BulkDeletePppRow[]
): Promise<{
  deleted: number;
  failed: { id: number; name: string; error: string }[];
}> {
  const failed: { id: number; name: string; error: string }[] = [];
  if (secrets.length === 0) return { deleted: 0, failed };

  const first = secrets[0];
  if (secrets.some((s) => s.routerId !== first.routerId)) {
    throw new Error("bulkDeletePppSecretsOnSameRouter: routerId campur");
  }

  let deleted = 0;
  for (const s of secrets) {
    try {
      await deletePppSecretFromDb(s.id, s.routerId, s.name);
      deleted += 1;
    } catch (err) {
      failed.push({
        id: s.id,
        name: s.name,
        error: (err as Error).message,
      });
    }
  }
  return { deleted, failed };
}
