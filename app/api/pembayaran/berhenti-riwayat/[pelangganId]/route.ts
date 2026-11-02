import { validateRequest } from "@/lib/auth";
import { getPelangganInScope } from "@/lib/authz";
import { berhentiRiwayatByPelanggan } from "@/lib/pelanggan-status-log";
import { staffMenuApiForbidden } from "@/lib/staff-menu-api";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  segmentData: { params: Promise<{ pelangganId: string }> }
) {
  const { user, session } = await validateRequest();
  if (!session || !user) {
    return NextResponse.json({ error: "Tidak terotentikasi" }, { status: 401 });
  }
  const denied = staffMenuApiForbidden(user, request.nextUrl.pathname);
  if (denied) return denied;

  const params = await segmentData.params;
  const pelangganId = parseInt(params.pelangganId, 10);
  if (!Number.isFinite(pelangganId)) {
    return NextResponse.json({ error: "Pelanggan tidak valid" }, { status: 400 });
  }

  const pelanggan = await getPelangganInScope(pelangganId, user);
  if (!pelanggan) {
    return NextResponse.json(
      { error: "Pelanggan tidak ditemukan atau akses ditolak" },
      { status: 403 }
    );
  }

  const data = await berhentiRiwayatByPelanggan(pelangganId);
  return NextResponse.json({ data });
}
