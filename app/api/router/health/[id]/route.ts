import { validateRequest } from "@/lib/auth";
import { getRouterForUser } from "@/lib/authz";
import { staffMenuApiForbidden } from "@/lib/staff-menu-api";
import { errorApiResponse } from "@/lib/server-actions/api";
import { NextRequest, NextResponse } from "next/server";
import { routerToCredentialsWithHostPolicy, withRouterOsClient } from "@/lib/routeros-session";

export const dynamic = "force-dynamic";
export async function GET(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  const { session, user } = await validateRequest();
  if (!session || !user) return new Response(null, { status: 401 });
  const denied = staffMenuApiForbidden(user, request.nextUrl.pathname);
  if (denied) return denied;
  const paramsState = await segmentData.params;
  const id = paramsState.id;

  if (!id) return NextResponse.json("Bad request", { status: 400 });
  try {
    const router = await getRouterForUser(parseInt(id), user);
    if (!router)
      return NextResponse.json("Router tidak ditemukan atau akses ditolak", { status: 403 });

    try {
      const health = await withRouterOsClient(
        await routerToCredentialsWithHostPolicy(router),
        `health:${router.id}`,
        async (api) => {
          const rows = await api.write("/system/health/print");
          return rows?.at(0) ?? null;
        }
      );
      return NextResponse.json(health);
    } catch {
      return NextResponse.json(null);
    }
  } catch (err) {
    return errorApiResponse(err);
  }
}
