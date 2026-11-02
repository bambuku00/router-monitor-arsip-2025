import { validateRequest } from "@/lib/auth";
import { listPenugasanPelanggan, resolvePenagihanOwner } from "@/lib/penagih";
import { canAccessPenagihan } from "@/lib/penagih-rules";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { user, session } = await validateRequest();
  if (!session || !user) return new Response(null, { status: 401 });
  if (!canAccessPenagihan(user.role)) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }
  const sp = request.nextUrl.searchParams;
  const requested = Number(sp.get("mitraId"));
  const scope = await resolvePenagihanOwner(
    user,
    Number.isInteger(requested) && requested > 0 ? requested : null
  );
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });
  const penagihRaw = sp.get("penagihId");
  const penagihId =
    penagihRaw == null || penagihRaw === ""
      ? null
      : Number(penagihRaw);
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);
  const result = await listPenugasanPelanggan({
    ownerUserId: scope.ownerUserId,
    q: sp.get("q") ?? "",
    penagihId: Number.isInteger(penagihId) ? penagihId : null,
    page,
    limit: 40,
  });
  return NextResponse.json({
    ...result,
    page,
    totalPages: Math.ceil(result.total / 40) || 1,
  });
}
