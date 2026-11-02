import { validateRequest } from "@/lib/auth";
import {
  createPenagih,
  listPenagih,
  listPenugasanRiwayat,
  resolvePenagihanOwner,
} from "@/lib/penagih";
import { canAccessPenagihan } from "@/lib/penagih-rules";
import { parseKomisiField } from "@/lib/komisi-petugas";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function mitraIdFrom(request: NextRequest, body?: { mitraId?: unknown }) {
  const fromQuery = Number(request.nextUrl.searchParams.get("mitraId"));
  const fromBody = Number(body?.mitraId);
  if (Number.isInteger(fromBody) && fromBody > 0) return fromBody;
  if (Number.isInteger(fromQuery) && fromQuery > 0) return fromQuery;
  return null;
}

export async function GET(request: NextRequest) {
  const { user, session } = await validateRequest();
  if (!session || !user) return new Response(null, { status: 401 });
  if (!canAccessPenagihan(user.role)) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }
  const scope = await resolvePenagihanOwner(user, mitraIdFrom(request));
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });
  const [penagih, riwayat] = await Promise.all([
    listPenagih(scope.ownerUserId),
    listPenugasanRiwayat(scope.ownerUserId),
  ]);
  return NextResponse.json({
    ownerUserId: scope.ownerUserId,
    penagih: penagih.map((row) => ({
      id: row.id,
      nama: row.nama,
      nomor: row.nomor,
      aktif: row.aktif,
      jumlahPelanggan: row._count.penugasan,
      akunUser: row.akun?.user ?? null,
      komisiNominal: row.komisiNominal,
    })),
    riwayat,
  });
}

export async function POST(request: NextRequest) {
  const { user, session } = await validateRequest();
  if (!session || !user) return new Response(null, { status: 401 });
  if (!canAccessPenagihan(user.role)) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as {
    mitraId?: unknown;
    nama?: unknown;
    nomor?: unknown;
    username?: unknown;
    password?: unknown;
    komisiNominal?: unknown;
  } | null;
  const scope = await resolvePenagihanOwner(user, mitraIdFrom(request, body ?? undefined));
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status });
  const komisi = parseKomisiField(body?.komisiNominal);
  if (!komisi.ok) return NextResponse.json({ error: komisi.error }, { status: 400 });
  const result = await createPenagih({
    ownerUserId: scope.ownerUserId,
    nama: typeof body?.nama === "string" ? body.nama : "",
    nomor: typeof body?.nomor === "string" ? body.nomor : null,
    username: typeof body?.username === "string" ? body.username : null,
    password: typeof body?.password === "string" ? body.password : null,
    komisiNominal: komisi.nominal,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ penagih: result.penagih });
}
