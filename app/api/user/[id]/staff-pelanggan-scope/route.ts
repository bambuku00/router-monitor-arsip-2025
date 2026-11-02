import { validateRequest } from "@/lib/auth";
import { canAccessManagedUser } from "@/lib/rbac";
import { loadStaffPelangganScopeForForm } from "@/lib/staff-pelanggan-scope";
import { errorApiResponse } from "@/lib/server-actions/api";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Scope pelanggan PPP staff (null = tidak dibatasi). */
export async function GET(
  _: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  try {
    const { user, session } = await validateRequest();
    if (!session || !user) {
      return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
    }

    const params = await segmentData.params;
    const targetId = params.id ? parseInt(params.id, 10) : NaN;
    if (!Number.isFinite(targetId)) {
      return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });
    }

    if (!(await canAccessManagedUser(user, targetId))) {
      return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });
    }

    const target = await prisma.user.findUnique({
      where: { id: targetId },
      select: { role: true },
    });
    if (!target || (target.role !== "Teknisi" && target.role !== "Keuangan")) {
      return NextResponse.json({ data: null });
    }

    const scope = await loadStaffPelangganScopeForForm(targetId);
    return NextResponse.json({ data: scope });
  } catch (err) {
    return errorApiResponse(err);
  }
}
