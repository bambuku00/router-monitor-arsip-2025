import { PELANGGAN_PORTAL_COOKIE, readPelangganPortalSession } from "@/lib/pelanggan-portal";
import prisma from "@/lib/prisma";
import { listTripayChannels, loadActiveTripay } from "@/lib/tripay";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
  const pelangganId = readPelangganPortalSession(
    (await cookies()).get(PELANGGAN_PORTAL_COOKIE)?.value
  );
  if (!pelangganId) {
    return NextResponse.json({ error: "Sesi portal berakhir." }, { status: 401 });
  }
  const pelanggan = await prisma.pelanggan.findFirst({
    where: { id: pelangganId },
    select: { router: { select: { userId: true } } },
  });
  const gateway = await loadActiveTripay(pelanggan?.router.userId);
  if (!gateway) {
    return NextResponse.json(
      { error: "Pembayaran online belum dihidupkan." },
      { status: 400 }
    );
  }
  try {
    const channels = await listTripayChannels(gateway);
    return NextResponse.json({ data: channels });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Gagal memuat kanal pembayaran." },
      { status: 502 }
    );
  }
}
