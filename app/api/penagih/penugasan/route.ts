import { validateRequest } from "@/lib/auth";
import { assignPelangganToPenagih, clearPelangganPenagih, resolvePenagihanOwner } from "@/lib/penagih";
import { canAccessPenagihan } from "@/lib/penagih-rules";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const { user, session } = await validateRequest();
  if (!session || !user) return new Response(null, { status: 401 });
  if (!canAccessPenagihan(user.role)) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as {
    mitraId?: unknown;
    penagihId?: unknown;
    pelangganIds?: unknown;
    hapus?: unknown;
  } | null;
  const requested = Number(body?.mitraId);
  const scope = await resolvePenagihanOwner(
    user,
    Number.isInteger(requested) && requested > 0 ? requested : null
  );
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });
  const penagihId = Number(body?.penagihId);
  const pelangganIds = Array.isArray(body?.pelangganIds)
    ? body.pelangganIds.map((id) => Number(id))
    : [];
  if (body?.hapus === true) {
    const cleared = await clearPelangganPenagih({
      ownerUserId: scope.ownerUserId,
      actor: user,
      pelangganIds,
    });
    if (!cleared.ok) {
      return NextResponse.json({ error: cleared.error }, { status: cleared.status });
    }
    return NextResponse.json({ updated: cleared.updated, skipped: 0 });
  }
  const result = await assignPelangganToPenagih({
    ownerUserId: scope.ownerUserId,
    actor: user,
    penagihId,
    pelangganIds,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ updated: result.updated, skipped: result.skipped });
}
