import { validateRequest } from "@/lib/auth";
import { canAccessManagedUser } from "@/lib/rbac";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  try {
    const { user, session } = await validateRequest();
    if (!session || !user) return new Response(null, { status: 401 });
    const params = await segmentData.params;
    if (!params.id) return NextResponse.json("Bad request", { status: 400 });

    const get = await prisma.client.findUnique({
      where: { id: parseInt(params.id) },
      include: {
        layanan: true,
        perorangan: true,
      },
    });
    if (!get)
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    // Authorize by client owner (userId) — do not return another tenant's client.
    if (!(await canAccessManagedUser(user, get.userId)))
      return new Response(null, { status: 403 });

    return NextResponse.json({
      data: get,
      message: "Client telah berhasil ditemukan",
    });
  } catch (err) {
    const error = err as Error;
    logger.error({ msg: "GET client/[id] error", error: error.message });
    return NextResponse.json(error.message, { status: 400 });
  }
}
