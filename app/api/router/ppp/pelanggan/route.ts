import { validateRequest } from "@/lib/auth";
import { createPelangganLinkedToPpp } from "@/lib/pelanggan-ppp-create";
import { staffMenuApiForbidden } from "@/lib/staff-menu-api";
import { errorApiResponse } from "@/lib/server-actions/api";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { user, session } = await validateRequest();
    if (!session || !user) return new Response(null, { status: 401 });
    const denied = staffMenuApiForbidden(user, request.nextUrl.pathname);
    if (denied) return denied;
    const raw = await request.json();
    const result = await createPelangganLinkedToPpp(user, raw);
    if (!result.ok) {
      return NextResponse.json(result.body, { status: result.status });
    }
    return NextResponse.json({
      data: { id: result.pelangganId },
      message: result.message,
    });
  } catch (err) {
    return errorApiResponse(err);
  }
}
