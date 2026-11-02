import { validateRequest } from "@/lib/auth";
import { resolvePenagihanOwner, updatePenagih, deletePenagih } from "@/lib/penagih";
import { canAccessPenagihan } from "@/lib/penagih-rules";
import { parseKomisiField } from "@/lib/komisi-petugas";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  const { user, session } = await validateRequest();
  if (!session || !user) return new Response(null, { status: 401 });
  if (!canAccessPenagihan(user.role)) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }
  const params = await segmentData.params;
  const penagihId = Number(params.id);
  const body = (await request.json().catch(() => null)) as {
    mitraId?: unknown;
    nama?: unknown;
    nomor?: unknown;
    aktif?: unknown;
    username?: unknown;
    password?: unknown;
    cabutAkun?: unknown;
    komisiNominal?: unknown;
  } | null;
  const requested = Number(body?.mitraId);
  const scope = await resolvePenagihanOwner(
    user,
    Number.isInteger(requested) && requested > 0 ? requested : null
  );
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });
  const komisi =
    body && "komisiNominal" in body ? parseKomisiField(body.komisiNominal) : null;
  if (komisi && !komisi.ok) {
    return NextResponse.json({ error: komisi.error }, { status: 400 });
  }
  const result = await updatePenagih({
    ownerUserId: scope.ownerUserId,
    penagihId,
    ...(typeof body?.nama === "string" ? { nama: body.nama } : {}),
    ...(body && "nomor" in body
      ? { nomor: typeof body.nomor === "string" ? body.nomor : null }
      : {}),
    ...(typeof body?.aktif === "boolean" ? { aktif: body.aktif } : {}),
    ...(typeof body?.username === "string" ? { username: body.username } : {}),
    ...(typeof body?.password === "string" ? { password: body.password } : {}),
    ...(body?.cabutAkun === true ? { cabutAkun: true } : {}),
    ...(komisi?.ok ? { komisiNominal: komisi.nominal } : {}),
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ penagih: result.penagih });
}

export async function DELETE(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  const { user, session } = await validateRequest();
  if (!session || !user) return new Response(null, { status: 401 });
  if (!canAccessPenagihan(user.role)) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }
  const params = await segmentData.params;
  const requested = Number(request.nextUrl.searchParams.get("mitraId"));
  const scope = await resolvePenagihanOwner(
    user,
    Number.isInteger(requested) && requested > 0 ? requested : null
  );
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });
  const result = await deletePenagih({
    ownerUserId: scope.ownerUserId,
    actor: user,
    penagihId: Number(params.id),
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ removedAssignments: result.removedAssignments });
}
