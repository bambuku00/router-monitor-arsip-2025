"use server";

import { verify } from "argon2";
import { validateRequest } from "@/lib/auth";
import { getPembayaranInScope } from "@/lib/authz";
import { logger } from "@/lib/logger";
import { getJakartaBillContext } from "@/lib/billing-generate-config";
import { dedupePelangganForMitraRouters } from "@/lib/pembayaran-dedupe-pelanggan";
import { rememberDeletedTagihanPeriods } from "@/lib/pembayaran-backfill";
import { dedupeTagihanDuplikatForMitraRouters } from "@/lib/pembayaran-dedupe-tagihan";
import prisma from "@/lib/prisma";
import { Prisma, StatusBayar } from "@prisma/client";

/** Hapus semua pelanggan tanpa PPP (duplikat/yatim) beserta seluruh tagihannya. */
async function deletePelangganTanpaPpp(
  tx: Prisma.TransactionClient,
  scope: { routerIds?: number[]; pelangganIds?: number[] }
): Promise<number> {
  const where: Prisma.PelangganWhereInput = {
    ppp_secretId: null,
  };
  if (scope.routerIds?.length) {
    where.routerId = { in: scope.routerIds };
  }
  if (scope.pelangganIds?.length) {
    where.id = { in: scope.pelangganIds };
  }

  const targets = await tx.pelanggan.findMany({
    where,
    select: { id: true },
  });
  if (targets.length === 0) return 0;

  const ids = targets.map((t) => t.id);
  const pembayaranIds = (
    await tx.pembayaran.findMany({
      where: { pelangganId: { in: ids } },
      select: { id: true },
    })
  ).map((p) => p.id);

  if (pembayaranIds.length > 0) {
    await tx.logBayar.deleteMany({
      where: { pembayaranId: { in: pembayaranIds } },
    });
    await tx.pembayaran.deleteMany({
      where: { id: { in: pembayaranIds } },
    });
  }

  const result = await tx.pelanggan.deleteMany({ where: { id: { in: ids } } });
  return result.count;
}

async function deletePembayaranRecords(
  tx: Prisma.TransactionClient,
  pembayaranIds: number[]
): Promise<number> {
  if (pembayaranIds.length === 0) return 0;
  await tx.logBayar.deleteMany({
    where: { pembayaranId: { in: pembayaranIds } },
  });
  const result = await tx.pembayaran.deleteMany({
    where: { id: { in: pembayaranIds } },
  });
  return result.count;
}

async function assertSuperadminPassword(userId: number, password: string) {
  if (!password || typeof password !== "string") {
    return { error: "Password wajib diisi" } as const;
  }
  const userWithPassword = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true },
  });
  if (!userWithPassword) return { error: "User tidak ditemukan" } as const;
  const validPassword = await verify(userWithPassword.password, password);
  if (!validPassword) return { error: "Password salah" } as const;
  return { ok: true as const };
}

function monthJatuhTempoRange(bulan: string) {
  const [year, month] = bulan.trim().split("-").map(Number);
  return {
    gte: new Date(year, month - 1, 1).toLocaleDateString("fr-CA"),
    lte: new Date(year, month, 0).toLocaleDateString("fr-CA"),
  };
}

async function routerIdsForMitra(mitraUserId: number) {
  return (
    await prisma.router.findMany({
      where: { userId: mitraUserId },
      select: { id: true },
    })
  ).map((r) => r.id);
}

/** Hapus tagihan + log generate mitra dari database (opsional per bulan, opsional status). */
async function resetMitraTagihanInDb(
  tx: Prisma.TransactionClient,
  mitraUserId: number,
  routerIds: number[],
  options: { bulan?: string; unpaidOnly?: boolean } = {}
): Promise<{
  tagihanRemoved: number;
  orphanRemoved: number;
  logsRemoved: number;
}> {
  const jatuhTempo = options.bulan
    ? monthJatuhTempoRange(options.bulan)
    : undefined;

  const pembayaranWhere: Prisma.PembayaranWhereInput = {
    ...(jatuhTempo ? { jatuh_tempo: jatuhTempo } : {}),
    pelanggan: { routerId: { in: routerIds } },
    ...(options.unpaidOnly ? { status: StatusBayar.Belum } : {}),
  };

  const pembayaranIds = (
    await tx.pembayaran.findMany({
      where: pembayaranWhere,
      select: { id: true },
    })
  ).map((p) => p.id);

  const tagihanRemoved = await deletePembayaranRecords(tx, pembayaranIds);
  const orphanRemoved = options.unpaidOnly
    ? 0
    : await dedupePelangganForMitraRouters(routerIds, tx);

  const logsRemoved = options.bulan
    ? (
        await tx.billingGenerateLog.deleteMany({
          where: { userId: mitraUserId, period: options.bulan.trim() },
        })
      ).count
    : options.unpaidOnly
      ? 0
      : (
          await tx.billingGenerateLog.deleteMany({
            where: { userId: mitraUserId },
          })
        ).count;

  return { tagihanRemoved, orphanRemoved, logsRemoved };
}

function formatResetDbMessage(parts: {
  tagihanRemoved: number;
  orphanRemoved: number;
  logsRemoved: number;
  scopeLabel: string;
  unpaidOnly?: boolean;
}): string {
  const messages: string[] = [];
  if (parts.tagihanRemoved > 0) {
    messages.push(
      parts.unpaidOnly
        ? `${parts.tagihanRemoved} tagihan belum bayar dihapus dari database`
        : `${parts.tagihanRemoved} tagihan dihapus dari database`
    );
  }
  if (parts.orphanRemoved > 0) {
    messages.push(
      `${parts.orphanRemoved} pelanggan tanpa PPP dihapus dari database`
    );
  }
  if (parts.logsRemoved > 0) {
    messages.push(`${parts.logsRemoved} log generate dihapus`);
  }
  if (messages.length === 0) {
    return `Database tagihan ${parts.scopeLabel} sudah kosong`;
  }
  return `${messages.join("; ")} (${parts.scopeLabel}). Generate ulang untuk isi data baru.`;
}

export async function bulkDelPembayaran(ids: number[], password: string) {
  if (!ids?.length) return { error: "Tidak ada tagihan yang dipilih" };

  const { user, session } = await validateRequest();
  if (!session || !user) return { error: "Unauthorized" };
  if (user.role !== "Superadmin") {
    return { error: "Hanya Superadmin yang dapat menghapus tagihan secara massal" };
  }

  if (!password || typeof password !== "string") {
    return { error: "Password wajib diisi" };
  }

  const userWithPassword = await prisma.user.findUnique({
    where: { id: user.id },
    select: { password: true },
  });
  if (!userWithPassword) return { error: "User tidak ditemukan" };

  const validPassword = await verify(userWithPassword.password, password);
  if (!validPassword) return { error: "Password salah" };

  const uniqueIds = [...new Set(ids)];
  const deletableIds: number[] = [];
  for (const pembId of uniqueIds) {
    const pemb = await getPembayaranInScope(pembId, user);
    if (!pemb || pemb.status !== StatusBayar.Belum) continue;
    deletableIds.push(pembId);
  }

  if (deletableIds.length === 0) {
    return {
      error:
        "Tidak ada tagihan status Belum yang dapat dihapus dalam pilihan, atau akses ditolak",
    };
  }

  try {
    const affectedPelangganIds = [
      ...new Set(
        (
          await prisma.pembayaran.findMany({
            where: { id: { in: deletableIds } },
            select: { pelangganId: true },
          })
        ).map((p) => p.pelangganId)
      ),
    ];

    let orphanRemoved = 0;
    await prisma.$transaction(async (tx) => {
      await tx.logBayar.deleteMany({
        where: { pembayaranId: { in: deletableIds } },
      });
      await tx.pembayaran.deleteMany({
        where: {
          id: { in: deletableIds },
          status: StatusBayar.Belum,
        },
      });
      orphanRemoved = await deletePelangganTanpaPpp(tx, {
        pelangganIds: affectedPelangganIds,
      });
    });

    const skipped = uniqueIds.length - deletableIds.length;
    let msg = `${deletableIds.length} tagihan berhasil dihapus`;
    if (orphanRemoved > 0) {
      msg += `; ${orphanRemoved} pelanggan tanpa PPP ikut dibersihkan`;
    }
    if (skipped > 0) {
      msg += ` (${skipped} tidak dihapus atau sudah lunas)`;
    }
    return { success: msg };
  } catch (err) {
    const error = err as Error;
    logger.error({ msg: "bulkDelPembayaran error", error: error.message });
    return { error: error.message };
  }
}

/** Superadmin: hapus tagihan belum bayar bulan berjalan (zona Jakarta). */
export async function bulkDelUnpaidPembayaranMitraBulanIni(
  mitraUserId: number,
  password: string
) {
  const { period } = getJakartaBillContext();
  return bulkDelAllUnpaidPembayaranMitraBulan(mitraUserId, period, password);
}

/** Superadmin: hapus tagihan duplikat per pelanggan per bulan (opsional satu bulan). */
export async function dedupeTagihanDuplikatMitra(
  mitraUserId: number,
  password: string,
  options: { bulan?: string } = {}
) {
  if (!Number.isFinite(mitraUserId) || mitraUserId < 1) {
    return { error: "Pengguna mitra tidak valid" };
  }

  const bulan = options.bulan?.trim();
  if (bulan && !/^\d{4}-\d{2}$/.test(bulan)) {
    return { error: "Format bulan wajib YYYY-MM" };
  }

  const { user, session } = await validateRequest();
  if (!session || !user) return { error: "Unauthorized" };
  if (user.role !== "Superadmin") {
    return {
      error: "Hanya Superadmin yang dapat membersihkan tagihan duplikat",
    };
  }

  const auth = await assertSuperadminPassword(user.id, password);
  if ("error" in auth) return { error: auth.error };

  const routerIds = await routerIdsForMitra(mitraUserId);
  if (routerIds.length === 0) {
    return { error: "Mitra ini tidak punya router" };
  }

  try {
    let removed = 0;
    await prisma.$transaction(async (tx) => {
      removed = await dedupeTagihanDuplikatForMitraRouters(
        routerIds,
        { bulan },
        tx
      );
    });

    if (removed === 0) {
      const scopeLabel = bulan
        ? new Intl.DateTimeFormat("id-ID", {
            month: "long",
            year: "numeric",
          }).format(new Date(`${bulan}-01`))
        : "semua bulan";
      return {
        error: `Tidak ada tagihan duplikat untuk dibersihkan (${scopeLabel})`,
      };
    }

    const scopeLabel = bulan
      ? `bulan ${new Intl.DateTimeFormat("id-ID", {
          month: "long",
          year: "numeric",
        }).format(new Date(`${bulan}-01`))}`
      : "semua bulan mitra";

    return {
      success: `${removed} tagihan duplikat dihapus (${scopeLabel}). Tagihan Terbayar / yang punya data pembayaran dipertahankan.`,
    };
  } catch (err) {
    const error = err as Error;
    logger.error({
      msg: "dedupeTagihanDuplikatMitra error",
      error: error.message,
    });
    return { error: error.message };
  }
}

/** Superadmin: reset tagihan status Belum saja untuk satu bulan (Terbayar tetap). */
export async function bulkDelAllUnpaidPembayaranMitraBulan(
  mitraUserId: number,
  bulan: string,
  password: string
) {
  if (!Number.isFinite(mitraUserId) || mitraUserId < 1) {
    return { error: "Pengguna mitra tidak valid" };
  }
  if (!/^\d{4}-\d{2}$/.test(bulan.trim())) {
    return { error: "Format bulan wajib YYYY-MM" };
  }

  const { user, session } = await validateRequest();
  if (!session || !user) return { error: "Unauthorized" };
  if (user.role !== "Superadmin") {
    return {
      error:
        "Hanya Superadmin yang dapat mereset tagihan belum bayar untuk bulan tersebut",
    };
  }

  const auth = await assertSuperadminPassword(user.id, password);
  if ("error" in auth) return { error: auth.error };

  const routerIds = await routerIdsForMitra(mitraUserId);
  if (routerIds.length === 0) {
    return { error: "Mitra ini tidak punya router" };
  }

  try {
    let result = {
      tagihanRemoved: 0,
      orphanRemoved: 0,
      logsRemoved: 0,
    };
    await prisma.$transaction(async (tx) => {
      result = await resetMitraTagihanInDb(tx, mitraUserId, routerIds, {
        bulan,
        unpaidOnly: true,
      });
    });

    const periodLabel = new Intl.DateTimeFormat("id-ID", {
      month: "long",
      year: "numeric",
    }).format(new Date(`${bulan.trim()}-01`));

    return {
      success: formatResetDbMessage({
        ...result,
        scopeLabel: `bulan ${periodLabel} (belum bayar saja)`,
        unpaidOnly: true,
      }),
    };
  } catch (err) {
    const error = err as Error;
    logger.error({
      msg: "bulkDelAllUnpaidPembayaranMitraBulan error",
      error: error.message,
    });
    return { error: error.message };
  }
}

/** Superadmin: hapus semua tagihan (Belum + Terbayar) mitra untuk satu bulan + bersihkan pelanggan tanpa PPP. */
export async function bulkDelAllPembayaranMitraBulan(
  mitraUserId: number,
  bulan: string,
  password: string
) {
  if (!Number.isFinite(mitraUserId) || mitraUserId < 1) {
    return { error: "Pengguna mitra tidak valid" };
  }
  if (!/^\d{4}-\d{2}$/.test(bulan.trim())) {
    return { error: "Format bulan wajib YYYY-MM" };
  }

  const { user, session } = await validateRequest();
  if (!session || !user) return { error: "Unauthorized" };
  if (user.role !== "Superadmin") {
    return {
      error:
        "Hanya Superadmin yang dapat mereset tagihan (lunas + belum) untuk bulan tersebut",
    };
  }

  const auth = await assertSuperadminPassword(user.id, password);
  if ("error" in auth) return { error: auth.error };

  const routerIds = await routerIdsForMitra(mitraUserId);
  if (routerIds.length === 0) {
    return { error: "Mitra ini tidak punya router" };
  }

  try {
    let result = {
      tagihanRemoved: 0,
      orphanRemoved: 0,
      logsRemoved: 0,
    };
    await prisma.$transaction(async (tx) => {
      result = await resetMitraTagihanInDb(tx, mitraUserId, routerIds, {
        bulan,
      });
    });

    const periodLabel = new Intl.DateTimeFormat("id-ID", {
      month: "long",
      year: "numeric",
    }).format(new Date(`${bulan.trim()}-01`));

    return {
      success: formatResetDbMessage({
        ...result,
        scopeLabel: `bulan ${periodLabel}`,
      }),
    };
  } catch (err) {
    const error = err as Error;
    logger.error({
      msg: "bulkDelAllPembayaranMitraBulan error",
      error: error.message,
    });
    return { error: error.message };
  }
}

/** Superadmin: hapus semua tagihan mitra (semua bulan) dari database + log generate. */
export async function bulkDelAllPembayaranMitra(
  mitraUserId: number,
  password: string
) {
  if (!Number.isFinite(mitraUserId) || mitraUserId < 1) {
    return { error: "Pengguna mitra tidak valid" };
  }

  const { user, session } = await validateRequest();
  if (!session || !user) return { error: "Unauthorized" };
  if (user.role !== "Superadmin") {
    return {
      error: "Hanya Superadmin yang dapat mereset semua tagihan mitra",
    };
  }

  const auth = await assertSuperadminPassword(user.id, password);
  if ("error" in auth) return { error: auth.error };

  const routerIds = await routerIdsForMitra(mitraUserId);
  if (routerIds.length === 0) {
    return { error: "Mitra ini tidak punya router" };
  }

  try {
    let result = {
      tagihanRemoved: 0,
      orphanRemoved: 0,
      logsRemoved: 0,
    };
    await prisma.$transaction(async (tx) => {
      result = await resetMitraTagihanInDb(tx, mitraUserId, routerIds);
    });

    return {
      success: formatResetDbMessage({
        ...result,
        scopeLabel: "semua bulan mitra",
      }),
    };
  } catch (err) {
    const error = err as Error;
    logger.error({
      msg: "bulkDelAllPembayaranMitra error",
      error: error.message,
    });
    return { error: error.message };
  }
}

/** Superadmin: hapus semua pelanggan tanpa PPP (kolom PPP kosong) beserta tagihannya. */
export async function cleanupPelangganTanpaPppMitra(
  mitraUserId: number,
  password: string
) {
  if (!Number.isFinite(mitraUserId) || mitraUserId < 1) {
    return { error: "Pengguna mitra tidak valid" };
  }
  if (!password || typeof password !== "string") {
    return { error: "Password wajib diisi" };
  }

  const { user, session } = await validateRequest();
  if (!session || !user) return { error: "Unauthorized" };
  if (user.role !== "Superadmin") {
    return {
      error: "Hanya Superadmin yang dapat membersihkan pelanggan tanpa PPP",
    };
  }

  const userWithPassword = await prisma.user.findUnique({
    where: { id: user.id },
    select: { password: true },
  });
  if (!userWithPassword) return { error: "User tidak ditemukan" };

  const validPassword = await verify(userWithPassword.password, password);
  if (!validPassword) return { error: "Password salah" };

  const routerIds = (
    await prisma.router.findMany({
      where: { userId: mitraUserId },
      select: { id: true },
    })
  ).map((r) => r.id);

  if (routerIds.length === 0) {
    return { error: "Mitra ini tidak punya router" };
  }

  try {
    let removed = 0;
    await prisma.$transaction(async (tx) => {
      removed = await dedupePelangganForMitraRouters(routerIds, tx);
    });

    if (removed === 0) {
      return { error: "Tidak ada pelanggan tanpa PPP untuk dibersihkan" };
    }

    return {
      success: `${removed} pelanggan tanpa PPP berhasil dibersihkan (beserta tagihan terkait)`,
    };
  } catch (err) {
    const error = err as Error;
    logger.error({
      msg: "cleanupPelangganTanpaPppMitra error",
      error: error.message,
    });
    return { error: error.message };
  }
}

export async function delPembayaran(id: number, password: string) {
  if (!id) return { error: "Bad request" };

  const { user, session } = await validateRequest();
  if (!session || !user)
    return { error: "Unauthorized" };
  if (user.role !== "Superadmin" && user.role !== "Admin")
    return { error: "Forbidden" };

  const inScope = await getPembayaranInScope(id, user);
  if (!inScope)
    return { error: "Pembayaran not found or access denied" };

  if (!password || typeof password !== "string")
    return { error: "Password wajib diisi" };

  const userWithPassword = await prisma.user.findUnique({
    where: { id: user.id },
    select: { password: true },
  });
  if (!userWithPassword)
    return { error: "User tidak ditemukan" };

  const validPassword = await verify(userWithPassword.password, password);
  if (!validPassword)
    return { error: "Password salah" };

  try {
    const del = await prisma.pembayaran.delete({
      where: { id },
      include: {
        pelanggan: true,
      },
    });
    return {
      success: `Pembayaran pelanggan ${del.pelanggan.nama} pada tanggal ${del.jatuh_tempo} berhasil dihapus`,
    };
  } catch (err) {
    const error = err as Error;
    logger.error({ msg: "delPembayaran error", error: error.message });
    return { error: error.message };
  }
}

/**
 * Superadmin: hapus tagihan belum bayar pelanggan di halaman pembayaran.
 * Data user PPP, pelanggan, dan secret MikroTik tidak diubah.
 */
export async function hapusUserPppoeDariPembayaran(
  pelangganId: number,
  mitraUserId: number,
  password: string
) {
  if (!pelangganId || !mitraUserId) return { error: "Bad request" };

  const { user, session } = await validateRequest();
  if (!session || !user) return { error: "Unauthorized" };
  if (user.role !== "Superadmin") return { error: "Forbidden" };

  const passwordCheck = await assertSuperadminPassword(user.id, password);
  if ("error" in passwordCheck) return { error: passwordCheck.error };

  const pelanggan = await prisma.pelanggan.findUnique({
    where: { id: pelangganId },
    select: {
      id: true,
      nama: true,
      ppp_secretId: true,
      router: { select: { id: true, userId: true } },
      ppp_secret: { select: { id: true, name: true, routerId: true } },
    },
  });
  if (!pelanggan || pelanggan.router.userId !== mitraUserId) {
    return { error: "Pelanggan tidak ditemukan" };
  }
  if (!pelanggan.ppp_secret) {
    return { error: "Pelanggan ini tidak punya user PPP" };
  }

  try {
    const tagihanRemoved = await prisma.$transaction(async (tx) => {
      const unpaid = await tx.pembayaran.findMany({
        where: { pelangganId, status: StatusBayar.Belum },
        select: { id: true, jatuh_tempo: true },
      });
      await rememberDeletedTagihanPeriods(
        tx,
        pelangganId,
        unpaid.map((row) => row.jatuh_tempo)
      );
      return deletePembayaranRecords(
        tx,
        unpaid.map((row) => row.id)
      );
    });

    if (tagihanRemoved === 0) {
      return { error: "Tidak ada tagihan belum bayar untuk pelanggan ini" };
    }

    return {
      success: `${tagihanRemoved} tagihan belum bayar ${pelanggan.nama} dihapus. Data user PPP tetap ada.`,
    };
  } catch (err) {
    const error = err as Error;
    logger.error({
      msg: "hapusUserPppoeDariPembayaran error",
      error: error.message,
    });
    return { error: error.message };
  }
}
