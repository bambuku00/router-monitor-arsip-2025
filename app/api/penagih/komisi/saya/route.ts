import {
  hapusKomisiTagihanTidakLunas,
  keteranganKomisi,
  petugasKomisiTarget,
  ringkasKomisi,
} from "@/lib/komisi-petugas";
import { validateRequest } from "@/lib/auth";
import { staffMenuApiForbidden } from "@/lib/staff-menu-api";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { errorApiResponse } from "@/lib/server-actions/api";
import { NextRequest, NextResponse } from "next/server";

const kosong = { masuk: 0, dibatalkan: 0, saldo: 0, transaksi: 0 };

export async function GET(request: NextRequest) {
  try {
    const { user, session } = await validateRequest();
    if (!session || !user) return new Response(null, { status: 401 });

    const denied = staffMenuApiForbidden(user, request.nextUrl.pathname);
    if (denied) return denied;

    if (user.role !== "Petugas") {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
    }

    const requested =
      request.nextUrl.searchParams.get("userId") ??
      request.nextUrl.searchParams.get("penagihId") ??
      request.nextUrl.searchParams.get("actorUserId") ??
      request.nextUrl.searchParams.get("ownerUserId");
    if (!petugasKomisiTarget(user.id, requested).ok) {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
    }

    const penagih = await prisma.penagih.findFirst({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!penagih) {
      return NextResponse.json({ ringkas: kosong, data: [] });
    }

    await hapusKomisiTagihanTidakLunas(prisma);

    const [nominals, rows] = await Promise.all([
      prisma.komisiPetugasEntri.findMany({
        where: { penagihId: penagih.id },
        select: { nominal: true },
      }),
      prisma.komisiPetugasEntri.findMany({
        where: { penagihId: penagih.id },
        orderBy: { created: "desc" },
        take: 100,
        select: {
          id: true,
          nominal: true,
          created: true,
          pelanggan: { select: { nama: true } },
        },
      }),
    ]);

    return NextResponse.json({
      ringkas: ringkasKomisi(nominals),
      data: rows.map((row) => ({
        id: row.id,
        created: row.created,
        namaPelanggan: row.pelanggan.nama,
        keterangan: keteranganKomisi(row.nominal),
        nominal: row.nominal,
      })),
    });
  } catch (err) {
    logger.error(err);
    return errorApiResponse(err);
  }
}
