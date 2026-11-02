import { validateRequest } from "@/lib/auth";
import { canAccessUser } from "@/lib/rbac";
import { listPelangganOptionsForMitra } from "@/lib/staff-pelanggan-scope";
import { errorApiResponse } from "@/lib/server-actions/api";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Daftar pelanggan PPP mitra untuk form batas scope staff. */
export async function GET(request: NextRequest) {
  try {
    const { user, session } = await validateRequest();
    if (!session || !user) {
      return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
    }

    const mitraParam = request.nextUrl.searchParams.get("mitraId");
    const mitraId = mitraParam ? parseInt(mitraParam, 10) : NaN;
    if (!Number.isFinite(mitraId)) {
      return NextResponse.json({ error: "mitraId wajib diisi" }, { status: 400 });
    }

    if (user.role !== "Superadmin" && !canAccessUser(user, mitraId)) {
      return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });
    }

    const options = await listPelangganOptionsForMitra(mitraId);
    return NextResponse.json({ data: options });
  } catch (err) {
    return errorApiResponse(err);
  }
}
