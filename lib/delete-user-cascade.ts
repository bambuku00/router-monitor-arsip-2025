import prisma from "@/lib/prisma";
import { deleteRoutersOperationalInTransaction } from "@/lib/delete-router-operational";
import { Prisma } from "@prisma/client";

const pembayaranWhereForUser = (userId: number): Prisma.PembayaranWhereInput => ({
  OR: [
    { pelanggan: { router: { userId } } },
    { paket: { userId } },
  ],
});

/** Hapus data operasional user (mitra/Admin: router–pelanggan–PPP–pembayaran; Client: layanan; semua role: pembayaran mitra, bank, paket). */
async function purgeUserOperationalData(tx: Prisma.TransactionClient, userId: number) {
  const pembWhere = pembayaranWhereForUser(userId);

  await tx.logBayar.deleteMany({
    where: {
      OR: [{ inputterId: userId }, { pembayaran: pembWhere }],
    },
  });

  await tx.pembayaran.deleteMany({ where: pembWhere });

  const routers = await tx.router.findMany({
    where: { userId },
    select: { id: true },
  });
  const routerIds = routers.map((r) => r.id);

  await deleteRoutersOperationalInTransaction(tx, routerIds);

  /** Jaga-jaga: router dengan userId tersebut yang belum tertangkap (mis. inkonsistensi data). */
  await tx.router.deleteMany({ where: { userId } });
  await tx.logBayarMitra.deleteMany({
    where: { pembayaran: { userId } },
  });
  await tx.pembayaranMitra.deleteMany({ where: { userId } });

  const client = await tx.client.findUnique({ where: { userId }, select: { id: true } });
  if (client) {
    await tx.clientPerorangan.deleteMany({ where: { clientId: client.id } });
    await tx.layanan.deleteMany({ where: { clientId: client.id } });
    await tx.client.delete({ where: { userId } });
  }

  await tx.pengeluaran.deleteMany({ where: { userId } });
  await tx.bank.deleteMany({ where: { userId } });
  await tx.paket.deleteMany({ where: { userId } });

  await tx.user.updateMany({
    where: { parentId: userId },
    data: { parentId: null },
  });

  await tx.user.delete({ where: { id: userId } });
}

export async function cascadedRemoveUser(operatorId: number, targetUserId: number) {
  if (operatorId === targetUserId) {
    return { error: "Anda tidak dapat menghapus akun sendiri" as const, status: 400 };
  }

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, role: true, nama: true },
  });

  if (!target) {
    return { error: "User tidak ditemukan" as const, status: 404 };
  }

  if (target.role === "Superadmin") {
    const cnt = await prisma.user.count({ where: { role: "Superadmin" } });
    if (cnt <= 1) {
      return {
        error: "Tidak dapat menghapus satu-satunya akun Superadmin" as const,
        status: 400,
      };
    }
  }

  await prisma.$transaction(async (tx) => {
    await purgeUserOperationalData(tx, targetUserId);
  });

  return { message: `User "${target.nama}" dan data terkait berhasil dihapus` as const };
}
