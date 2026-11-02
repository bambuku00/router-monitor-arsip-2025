import {
  isPppBerhentiTab,
  isPppNonaktifTab,
} from "@/lib/ppp-nonaktif-berhenti";
import { bulkDeletePppSecretsOnSameRouter } from "@/lib/ppp-secret-delete";
import prisma from "@/lib/prisma";

export type BulkPppDeleteScope = "nonaktif" | "berhenti";

export async function runBulkDeletePppByTab(
  routerId: number,
  scope: BulkPppDeleteScope
) {
  const rows = await prisma.pppSecret.findMany({
    where: { routerId },
    include: {
      pelanggan: true,
      active_records: true,
      router: { select: { isolirProfileName: true } },
    },
  });

  const isolirProfileName = rows[0]?.router.isolirProfileName;
  const targets = rows.filter((row) =>
    scope === "berhenti"
      ? isPppBerhentiTab(row)
      : isPppNonaktifTab(row, isolirProfileName)
  );

  if (targets.length === 0) {
    const label = scope === "berhenti" ? "Berhenti" : "Nonaktif";
    return {
      message: `Tidak ada user PPP kategori ${label} untuk dihapus`,
      deleted: 0,
      failed: [] as { id: number; name: string; error: string }[],
    };
  }

  const { deleted, failed } = await bulkDeletePppSecretsOnSameRouter(targets);

  return {
    message:
      deleted > 0
        ? `${deleted} user PPP berhasil dihapus` +
          (failed.length ? ` (${failed.length} gagal)` : "")
        : failed.length > 0
          ? "Tidak ada yang terhapus"
          : "Selesai",
    deleted,
    failed,
  };
}

/** Hapus massal PPP yang sudah tidak ada di Mikrotik (on_router = false). */
export async function runBulkDeletePppOffRouter(routerId: number) {
  const targets = await prisma.pppSecret.findMany({
    where: { routerId, on_router: false },
    select: { id: true, routerId: true, name: true },
  });

  if (targets.length === 0) {
    return {
      message: "Tidak ada user PPP yang hilang di Mikrotik untuk dihapus",
      deleted: 0,
      failed: [] as { id: number; name: string; error: string }[],
    };
  }

  const { deleted, failed } = await bulkDeletePppSecretsOnSameRouter(targets);

  return {
    message:
      deleted > 0
        ? `${deleted} user PPP hilang di Mikrotik berhasil dihapus` +
          (failed.length ? ` (${failed.length} gagal)` : "")
        : failed.length > 0
          ? "Tidak ada yang terhapus"
          : "Selesai",
    deleted,
    failed,
  };
}
