import { validateRequest } from "@/lib/auth";
import { getRouterForUser } from "@/lib/authz";
import { runBulkDeletePppOffRouter } from "@/lib/ppp-bulk-delete-tab";
import { staffMenuApiForbidden } from "@/lib/staff-menu-api";
import { errorApiResponse } from "@/lib/server-actions/api";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  _request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  try {
    const { user, session } = await validateRequest();
    if (!session || !user) return new Response(null, { status: 401 });
    const denied = staffMenuApiForbidden(user, _request.nextUrl.pathname);
    if (denied) return denied;
    if (user.role !== "Superadmin") {
      return NextResponse.json({ message: "Hanya Superadmin" }, { status: 403 });
    }

    const params = await segmentData.params;
    const routerId = parseInt(params.id, 10);
    if (Number.isNaN(routerId)) {
      return NextResponse.json({ message: "Invalid router id" }, { status: 400 });
    }

    const routerForUser = await getRouterForUser(routerId, user);
    if (!routerForUser) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    const payload = await runBulkDeletePppOffRouter(routerId);
    return NextResponse.json(payload);
  } catch (err) {
    return errorApiResponse(err);
  }
}
