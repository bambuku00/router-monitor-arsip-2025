import { tryRestoreIsolirOnPayment } from "@/lib/auto-isolir/run";
import { catatKomisiPembayaranPetugas } from "@/lib/komisi-petugas";
import { formatIsolirActor } from "@/lib/isolir-actor-label";
import {
  claimPembayaranLunas,
  payPelangganMonthsAhead,
} from "@/lib/pembayaran-bulan-depan";
import { validateRequest } from "@/lib/auth";
import { getBankForUser, getPembayaranInScope } from "@/lib/authz";
import { canStaffPayViaBank } from "@/lib/rbac";
import { staffMenuApiForbidden } from "@/lib/staff-menu-api";
import { logger } from "@/lib/logger";
import {
  PembayaranPelanggan,
  PembayaranPelangganSchema,
} from "@/lib/pembayaran-types";
import { petugasBolehMencatatBayar } from "@/lib/petugas-bulan";
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

    const params = await segmentData.params;
    if (!params.id) return NextResponse.json("Bad request", { status: 400 });
    const pembayaranId = parseInt(params.id);
    const inScope = await getPembayaranInScope(pembayaranId, user);
    if (!inScope)
      return NextResponse.json("Pembayaran not found or access denied", { status: 403 });
    const data = (await request.json()) as PembayaranPelanggan | null;
    const parseSchema = PembayaranPelangganSchema.safeParse(data);

    if (!data || !parseSchema.success)
      return NextResponse.json("Data is not valid", { status: 400 });

    if (
      parseSchema.data.metode === "Transfer" &&
      !canStaffPayViaBank(user)
    ) {
      return NextResponse.json(
        { error: "Akun ini tidak diizinkan mencatat pembayaran via transfer/bank" },
        { status: 403 }
      );
    }

    // SECURITY (IDOR): bankId harus milik tenant user, cegah referensi bank mitra lain.
    if (parseSchema.data.metode === "Transfer") {
      if (data.bankId == null) {
        return NextResponse.json(
          { error: "Bank wajib dipilih untuk pembayaran transfer" },
          { status: 400 }
        );
      }
      const ownedBank = await getBankForUser(data.bankId, user);
      if (!ownedBank) {
        return NextResponse.json(
          { error: "Bank tidak ditemukan atau di luar akses Anda" },
          { status: 403 }
        );
      }
    }

    const bulanBayar = parseSchema.data.bulanBayar ?? 1;
    if (user.role === "Petugas" && bulanBayar > 1) {
      return NextResponse.json(
        { error: "Petugas hanya dapat membayar 1 bulan." },
        { status: 400 }
      );
    }
    if (
      user.role === "Petugas" &&
      !petugasBolehMencatatBayar(inScope.jatuh_tempo)
    ) {
      return NextResponse.json(
        { error: "Petugas hanya dapat membayar tagihan bulan ini." },
        { status: 400 }
      );
    }
    if (bulanBayar > 1 && inScope.pelanggan.stop) {
      return NextResponse.json(
        {
          error:
            "Pelanggan sudah berhenti. Pembayaran bulan berikutnya tidak dibuat.",
        },
        { status: 400 }
      );
    }

    const metodeBayar = parseSchema.data.metode;
    if (
      bulanBayar > 1 &&
      metodeBayar !== "Cash" &&
      metodeBayar !== "Transfer"
    ) {
      return NextResponse.json(
        { error: "Metode pembayaran wajib diisi" },
        { status: 400 }
      );
    }

    const bankId = data.metode === "Transfer" ? data.bankId ?? null : null;

    // Klaim status Belum di dalam transaksi. Permintaan kedua tidak menulis LogBayar.
    const paid = await prisma.$transaction(async (tx) => {
      if (bulanBayar > 1) {
        const ahead = await payPelangganMonthsAhead(tx, {
          source: {
            id: inScope.id,
            pelangganId: inScope.pelangganId,
            paketId: inScope.paketId,
            jatuh_tempo: inScope.jatuh_tempo,
            total: inScope.total,
          },
          bulanBayar,
          metode: metodeBayar === "Transfer" ? "Transfer" : "Cash",
          bankId,
          inputterId: user.id,
        });
        for (const row of ahead.claimed) {
          await catatKomisiPembayaranPetugas(tx, {
            actorUserId: user.id,
            pembayaranId: row.id,
            pelangganId: row.pelangganId,
            logBayarId: row.logBayarId,
          });
        }
        return ahead;
      }

      const claimed = await claimPembayaranLunas(tx, {
        pembayaranId,
        metode: data.metode ?? null,
        bankId,
        inputterId: user.id,
      });
      if (!claimed) {
        return {
          primary: null,
          newlyPaid: 0,
          message: "Tagihan ini sudah lunas",
        };
      }

      await catatKomisiPembayaranPetugas(tx, {
        actorUserId: user.id,
        pembayaranId: claimed.id,
        pelangganId: claimed.pelangganId,
        logBayarId: claimed.logBayarId,
      });

      return {
        primary: claimed,
        newlyPaid: 1,
        message: "Pembayaran telah berhasil",
      };
    });

    const patch = paid.primary;
    if (!patch || paid.newlyPaid < 1) {
      return NextResponse.json(
        { error: "Tagihan ini sudah lunas" },
        { status: 409 }
      );
    }

    try {
      await tryRestoreIsolirOnPayment({
        pelangganId: patch.pelangganId,
        pembayaranId: patch.id,
        executedBy: formatIsolirActor(user),
      });
    } catch (err) {
      logger.warn({ msg: "Auto restore isolir gagal", err });
    }

    return NextResponse.json({
      data: patch,
      message: paid.message,
    });
  } catch (err) {
    logger.error(err);
    return errorApiResponse(err);
  }
}
