import { validateRequest } from "@/lib/auth";
import { loadPenagihRekapMetode } from "@/lib/penagih-rekap-metode-load";
import { resolvePenagihanOwner } from "@/lib/penagih";
import { canAccessPenagihan } from "@/lib/penagih-rules";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { user, session } = await validateRequest();
  if (!session || !user) return new Response(null, { status: 401 });
  if (!canAccessPenagihan(user.role)) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const bulan = request.nextUrl.searchParams.get("bulan")?.trim() ?? "";
  if (!/^\d{4}-\d{2}$/.test(bulan)) {
    return NextResponse.json(
      { error: "Parameter bulan wajib format YYYY-MM" },
      { status: 400 }
    );
  }

  const mitraRaw = Number(request.nextUrl.searchParams.get("mitraId"));
  const mitraId = Number.isInteger(mitraRaw) && mitraRaw > 0 ? mitraRaw : null;
  const scope = await resolvePenagihanOwner(user, mitraId);
  if (!scope.ok) {
    return NextResponse.json({ error: scope.error }, { status: scope.status });
  }

  const penagihRaw = Number(request.nextUrl.searchParams.get("penagihId"));
  if (!Number.isInteger(penagihRaw) || penagihRaw <= 0) {
    return NextResponse.json({ error: "Petugas wajib dipilih" }, { status: 400 });
  }
  const data = await loadPenagihRekapMetode({
    ownerUserId: scope.ownerUserId,
    penagihId: penagihRaw,
    bulan,
  });
  if (!data) {
    return NextResponse.json({ error: "Petugas tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json(data);
}
