import { tryRestoreIsolirOnPayment } from "@/lib/auto-isolir/run";
import { formatIsolirActor } from "@/lib/isolir-actor-label";
import { validateRequest } from "@/lib/auth";
import { staffMenuApiForbidden } from "@/lib/staff-menu-api";
import { logger } from "@/lib/logger";
import { PembayaranPelangganSchema } from "@/lib/pembayaran-types";
import prisma from "@/lib/prisma";
import { errorApiResponse } from "@/lib/server-actions/api";
import { getBankForUser, getPembayaranInScope } from "@/lib/authz";
import { catatKomisiPembayaranPetugas } from "@/lib/komisi-petugas";
import { claimPembayaranLunas } from "@/lib/pembayaran-bulan-depan";
import { canBulkMarkPembayaranPelanggan, canStaffPayViaBank } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const BulkPaySchema = PembayaranPelangganSchema.pick({
  metode: true,
  bankId: true,
})
  .merge(
    z.object({
      ids: z.array(z.coerce.number().int()).min(1, "Pilih minimal satu tagihan"),
    })
  )
  .superRefine((data, ctx) => {
    if (data.metode === "Transfer" && data.bankId == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Bank wajib dipilih untuk transfer",
        path: ["bankId"],
      });
    }
  });

export async function POST(request: NextRequest) {
  try {
    const { user, session } = await validateRequest();
    if (!session || !user) return new Response(null, { status: 401 });

    const denied = staffMenuApiForbidden(user, request.nextUrl.pathname);
    if (denied) return denied;

    if (!canBulkMarkPembayaranPelanggan(user)) {
      return NextResponse.json(
        { message: "Akun petugas tidak dapat menjalankan pembayaran massal" },
        { status: 403 }
      );
    }

    const raw = await request.json();
    const parseResult = BulkPaySchema.safeParse(raw);

    if (!parseResult.success) {
      const flat = parseResult.error.flatten();
      const msg =
        [...flat.formErrors, ...Object.values(flat.fieldErrors).flat()].join(
          "; "
        ) || "Data tidak valid";
      return NextResponse.json({ message: msg }, { status: 400 });
    }

    const { ids, metode, bankId } = parseResult.data;

    if (metode === "Transfer" && !canStaffPayViaBank(user)) {
      return NextResponse.json(
        { message: "Akun ini tidak diizinkan mencatat pembayaran via transfer/bank" },
        { status: 403 }
      );
    }

    // SECURITY (IDOR): bankId harus milik tenant user, cegah referensi bank mitra lain.
    if (metode === "Transfer") {
      if (bankId == null) {
        return NextResponse.json(
          { message: "Bank wajib dipilih untuk pembayaran transfer" },
          { status: 400 }
        );
      }
      const ownedBank = await getBankForUser(bankId, user);
      if (!ownedBank) {
        return NextResponse.json(
          { message: "Bank tidak ditemukan atau di luar akses Anda" },
          { status: 403 }
        );
      }
    }

    const uniqueIds = [...new Set(ids)];

    const validIds: number[] = [];
    for (const id of uniqueIds) {
      const pembayaran = await getPembayaranInScope(id, user);
      if (pembayaran) {
        validIds.push(id);
      }
    }

    if (validIds.length === 0) {
      return NextResponse.json(
        { message: "Tidak ada tagihan dalam akses Anda" },
        { status: 403 }
      );
    }

    if (validIds.length !== uniqueIds.length) {
      logger.warn({
        msg: "Attempted to mark out-of-scope payments",
        userId: user.id,
        requestedCount: ids.length,
        validCount: validIds.length,
      });
    }

    let markedCount = 0;
    let paidForRestore: { id: number; pelangganId: number }[] = [];

    await prisma.$transaction(async (tx) => {
      const won: { id: number; pelangganId: number }[] = [];
      for (const id of validIds) {
        const claimed = await claimPembayaranLunas(tx, {
          pembayaranId: id,
          metode: metode ?? null,
          bankId: metode === "Transfer" ? bankId ?? null : null,
          inputterId: user.id,
        });
        if (!claimed) continue;
        await catatKomisiPembayaranPetugas(tx, {
          actorUserId: user.id,
          pembayaranId: claimed.id,
          pelangganId: claimed.pelangganId,
          logBayarId: claimed.logBayarId,
        });
        won.push(claimed);
      }
      markedCount = won.length;
      paidForRestore = won;
    });

    await Promise.allSettled(
      paidForRestore.map((row) =>
        tryRestoreIsolirOnPayment({
          pelangganId: row.pelangganId,
          pembayaranId: row.id,
          executedBy: formatIsolirActor(user),
        })
      )
    );

    return NextResponse.json({
      message:
        markedCount === 0
          ? "Tidak ada tagihan status Belum yang bisa ditandai terbayar pada pilihan ini"
          : `${markedCount} pembayaran telah berhasil diproses`,
    });
  } catch (err) {
    logger.error(err);
    return errorApiResponse(err);
  }
}
