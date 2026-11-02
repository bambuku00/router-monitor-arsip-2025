import { validateRequest } from "@/lib/auth";
import { batalkanKomisiPembayaran } from "@/lib/komisi-petugas";
import { getPembayaranInScope } from "@/lib/authz";
import { canCancelPembayaranPelanggan } from "@/lib/rbac";
import { staffMenuApiForbidden } from "@/lib/staff-menu-api";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { errorApiResponse } from "@/lib/server-actions/api";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { StatusBayar } from "@prisma/client";

const BulkRevertSchema = z.object({
  ids: z.array(z.coerce.number().int()).min(1, "Pilih minimal satu tagihan"),
});

export async function POST(request: NextRequest) {
  try {
    const { user, session } = await validateRequest();
    if (!session || !user) return new Response(null, { status: 401 });

    const denied = staffMenuApiForbidden(user, request.nextUrl.pathname);
    if (denied) return denied;

    if (!canCancelPembayaranPelanggan(user)) {
      return NextResponse.json(
        { message: "Staff tidak diizinkan membatalkan pembayaran" },
        { status: 403 }
      );
    }

    const raw = await request.json();
    const parseResult = BulkRevertSchema.safeParse(raw);

    if (!parseResult.success) {
      const msg = parseResult.error.flatten().formErrors.join("; ") || "Data tidak valid";
      return NextResponse.json({ message: msg }, { status: 400 });
    }

    const { ids } = parseResult.data;

    const uniqueIds = [...new Set(ids)];

    const validIds: number[] = [];
    for (const id of uniqueIds) {
      const pembayaran = await getPembayaranInScope(id, user);
      if (pembayaran) validIds.push(id);
    }

    if (validIds.length === 0) {
      return NextResponse.json(
        { message: "Tidak ada tagihan dalam akses Anda" },
        { status: 403 }
      );
    }

    if (validIds.length !== uniqueIds.length) {
      logger.warn({
        msg: "Bulk revert: sebagian id di luar akses",
        userId: user.id,
        requestedCount: uniqueIds.length,
        validCount: validIds.length,
      });
    }

    let revertedCount = 0;

    await prisma.$transaction(async (tx) => {
      const paidRows = await tx.pembayaran.findMany({
        where: {
          id: { in: validIds },
          status: StatusBayar.Terbayar,
        },
        select: { id: true, total: true },
      });

      revertedCount = paidRows.length;
      if (revertedCount === 0) return;

      const paidIds = paidRows.map((p) => p.id);

      await tx.pembayaran.updateMany({
        where: { id: { in: paidIds } },
        data: {
          status: StatusBayar.Belum,
          bankId: null,
          metode: null,
          inputterId: null,
          bayarSekaligus: null,
        },
      });

      await tx.logBayar.createMany({
        data: paidRows.map((p) => ({
          pembayaranId: p.id,
          inputterId: user.id,
          status: StatusBayar.Belum,
          total: p.total,
        })),
      });

      for (const id of paidIds) {
        await batalkanKomisiPembayaran(tx, id);
      }
    });

    return NextResponse.json({
      message:
        revertedCount === 0
          ? "Tidak ada tagihan Terbayar yang bisa dibatalkan pada pilihan ini"
          : `${revertedCount} pembayaran telah dibatalkan`,
    });
  } catch (err) {
    logger.error(err);
    return errorApiResponse(err);
  }
}
