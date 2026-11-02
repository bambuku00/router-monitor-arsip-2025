import { validateRequest } from "@/lib/auth";
import {
  assertStaffMayMutatePppSecret,
  getRouterForUser,
} from "@/lib/authz";
import { staffMenuApiForbidden } from "@/lib/staff-menu-api";
import { deletePppSecretEntity } from "@/lib/ppp-secret-delete";
import prisma from "@/lib/prisma";
import { errorApiResponse } from "@/lib/server-actions/api";
import { NextRequest, NextResponse } from "next/server";

export async function DELETE(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  try {
    const { user, session } = await validateRequest();
    if (!session || !user) return new Response(null, { status: 401 });

    const denied = staffMenuApiForbidden(user, request.nextUrl.pathname);
    if (denied) return denied;

    const params = await segmentData.params;
    const id = parseInt(params.id);
    if (isNaN(id)) return NextResponse.json("Invalid ID", { status: 400 });

    const pppSecret = await prisma.pppSecret.findUnique({
      where: { id: id },
    });

    if (!pppSecret) {
      return NextResponse.json("PPP Secret tidak ditemukan", { status: 404 });
    }

    const routerForUser = await getRouterForUser(pppSecret.routerId, user);
    if (!routerForUser)
      return NextResponse.json("Unauthorized", { status: 403 });

    const scoped = await assertStaffMayMutatePppSecret(user, pppSecret);
    if (!scoped.ok) {
      return NextResponse.json(
        { error: scoped.error },
        { status: scoped.status }
      );
    }

    const r = await deletePppSecretEntity(pppSecret);
    if (!r.ok) {
      return NextResponse.json(r.error, { status: 500 });
    }

    return NextResponse.json({ message: "Berhasil menghapus user PPP" });
  } catch (err) {
    return errorApiResponse(err);
  }
}
