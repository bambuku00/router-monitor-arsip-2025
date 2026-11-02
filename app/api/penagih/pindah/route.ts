import { validateRequest } from "@/lib/auth";
import { movePenagihPelanggan, resolvePenagihanOwner } from "@/lib/penagih";
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
    dariPenagihId?: unknown;
    kePenagihId?: unknown;
  } | null;
  const requested = Number(body?.mitraId);
  const scope = await resolvePenagihanOwner(
    user,
    Number.isInteger(requested) && requested > 0 ? requested : null
  );
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });
  const result = await movePenagihPelanggan({
    ownerUserId: scope.ownerUserId,
    actor: user,
    dariPenagihId: Number(body?.dariPenagihId),
    kePenagihId: Number(body?.kePenagihId),
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ updated: result.updated, skipped: result.skipped });
}
