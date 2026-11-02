import { validateRequest } from "@/lib/auth";
import { batalkanKomisiPembayaran } from "@/lib/komisi-petugas";
import { getPembayaranInScope } from "@/lib/authz";
import { canCancelPembayaranPelanggan } from "@/lib/rbac";
import { staffMenuApiForbidden } from "@/lib/staff-menu-api";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { errorApiResponse } from "@/lib/server-actions/api";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
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

    const params = await segmentData.params;
    if (!params.id) return NextResponse.json("Bad request", { status: 400 });
    const pembayaranId = parseInt(params.id);
    const inScope = await getPembayaranInScope(pembayaranId, user);
    if (!inScope)
      return NextResponse.json("Pembayaran not found or access denied", { status: 403 });

    // FINANCIAL: Atomic transaction ensures payment revert + audit log are inseparable
    const patch = await prisma.$transaction(async (tx) => {
      const updated = await tx.pembayaran.update({
        where: { id: pembayaranId },
        data: {
          status: "Belum",
          bankId: null,
          metode: null,
          inputterId: null,
          bayarSekaligus: null,
        },
      });
      
      await tx.logBayar.create({
        data: {
          pembayaranId: updated.id,
          inputterId: user.id,
          status: "Belum",
          total: updated.total,
        },
      });

      await batalkanKomisiPembayaran(tx, updated.id);

      return updated;
    });

    return NextResponse.json({
      data: patch,
      message: "Pembayaran telah dibatalkan",
    });
  } catch (err) {
    logger.error(err);
    return errorApiResponse(err);
  }
}
