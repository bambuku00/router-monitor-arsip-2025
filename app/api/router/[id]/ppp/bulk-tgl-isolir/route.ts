import { validateRequest } from "@/lib/auth";
import { getRouterForUser } from "@/lib/authz";
import { bulkSetPelangganTglIsolir } from "@/lib/ppp-bulk-tgl-isolir";
import { errorApiResponse } from "@/lib/server-actions/api";
import { revalidatePPP } from "@/lib/server-actions/router/ppp/actions";
import { staffMenuApiForbidden } from "@/lib/staff-menu-api";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const BodySchema = z.object({
  tgl_isolir: z.number().int().min(1).max(30),
});

export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  const { session, user } = await validateRequest();
  if (!session || !user) return new Response(null, { status: 401 });

  const denied = staffMenuApiForbidden(user, request.nextUrl.pathname);
  if (denied) return denied;

  const params = await segmentData.params;
  const routerId = parseInt(params.id, 10);
  if (!params.id || Number.isNaN(routerId)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const routerCheck = await getRouterForUser(routerId, user);
  if (!routerCheck) {
    return NextResponse.json(
      { error: "Router tidak ditemukan atau akses ditolak" },
      { status: 403 }
    );
  }

  const raw = await request.json().catch(() => null);
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Tanggal isolir harus antara 1 dan 30" },
      { status: 400 }
    );
  }

  try {
    const result = await bulkSetPelangganTglIsolir(
      routerId,
      user,
      parsed.data.tgl_isolir
    );
    await revalidatePPP();

    const message =
      result.updated === 0
        ? "Tidak ada pelanggan yang diperbarui."
        : `Tanggal isolir ${parsed.data.tgl_isolir} diterapkan ke ${result.updated} pelanggan.`;

    return NextResponse.json({ data: result, message });
  } catch (err) {
    return errorApiResponse(err);
  }
}
