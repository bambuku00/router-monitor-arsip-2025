import { guardKomisiAdmin, keteranganKomisi } from "@/lib/komisi-petugas";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { errorApiResponse } from "@/lib/server-actions/api";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  segmentData: { params: Promise<{ penagihId: string }> }
) {
  try {
    const gate = await guardKomisiAdmin(request);
    if (!gate.ok) return gate.response;

    const params = await segmentData.params;
    const penagihId = Number(params.penagihId);
    if (!Number.isInteger(penagihId)) {
      return NextResponse.json({ error: "Petugas tidak ditemukan" }, { status: 404 });
    }

    const penagih = await prisma.penagih.findFirst({
      where: { id: penagihId, ownerUserId: gate.ownerUserId },
      select: { id: true, nama: true },
    });
    if (!penagih) {
      return NextResponse.json({ error: "Petugas tidak ditemukan" }, { status: 404 });
    }

    const rows = await prisma.komisiPetugasEntri.findMany({
      where: { penagihId: penagih.id, ownerUserId: gate.ownerUserId },
      orderBy: { created: "desc" },
      take: 200,
      select: {
        id: true,
        nominal: true,
        created: true,
        pelanggan: { select: { nama: true } },
      },
    });

    return NextResponse.json({
      penagih,
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
