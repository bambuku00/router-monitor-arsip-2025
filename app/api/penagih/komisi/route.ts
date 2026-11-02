import {
  guardKomisiAdmin,
  hapusKomisiTagihanTidakLunas,
  ringkasKomisi,
} from "@/lib/komisi-petugas";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { errorApiResponse } from "@/lib/server-actions/api";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const gate = await guardKomisiAdmin(request);
    if (!gate.ok) return gate.response;

    await hapusKomisiTagihanTidakLunas(prisma);

    const petugas = await prisma.penagih.findMany({
      where: { ownerUserId: gate.ownerUserId },
      select: { id: true, nama: true, aktif: true, komisiNominal: true },
      orderBy: [{ aktif: "desc" }, { nama: "asc" }],
    });

    const rows = await prisma.komisiPetugasEntri.findMany({
      where: { ownerUserId: gate.ownerUserId },
      select: { penagihId: true, nominal: true },
    });

    const byPenagih = new Map<number, { nominal: number }[]>();
    for (const row of rows) {
      const list = byPenagih.get(row.penagihId) ?? [];
      list.push(row);
      byPenagih.set(row.penagihId, list);
    }

    return NextResponse.json({
      data: petugas.map((item) => ({
        penagihId: item.id,
        nama: item.nama,
        aktif: item.aktif,
        komisiNominal: item.komisiNominal,
        ...ringkasKomisi(byPenagih.get(item.id) ?? []),
      })),
    });
  } catch (err) {
    logger.error(err);
    return errorApiResponse(err);
  }
}
