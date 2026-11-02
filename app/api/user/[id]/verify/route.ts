import { validateRequest } from "@/lib/auth";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { canAccessManagedUser, hasRole } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";

export async function PATCH(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  const { session, user } = await validateRequest();
  if (!session || !user) return new Response(null, { status: 401 });
  if (!hasRole(user, ["Admin", "Superadmin"]))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const params = await segmentData.params;
  if (!params.id) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const id = parseInt(params.id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  if (!(await canAccessManagedUser(user, id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const patch = await prisma.user.update({
      where: { id: id },
      data: { verified: true },
      select: {
        id: true,
        nama: true,
        user: true,
        role: true,
        verified: true,
        disabled: true,
        nomor: true,
        parentId: true,
        created: true,
        updated: true,
      },
    });
    return NextResponse.json({
      data: patch,
      message: `User ${patch.nama} berhasil diverifikasi`,
    });
  } catch (err) {
    const error = err as Error;
    logger.error({ msg: "PATCH user verify error", error: error.message });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
