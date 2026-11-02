import { validateRequest } from "@/lib/auth";
import { getRouterForUser } from "@/lib/authz";
import { staffMenuApiForbidden } from "@/lib/staff-menu-api";
import { errorApiResponse } from "@/lib/server-actions/api";
import {
  redactPppPasswordsUnlessSuperadmin,
} from "@/lib/ppp-password-redact";
import { NextRequest, NextResponse } from "next/server";
import {
  routerToCredentialsWithHostPolicy,
  withRouterOsClient,
} from "@/lib/routeros-session";

export const dynamic = "force-dynamic";
export async function GET(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  const { session, user } = await validateRequest();
  if (!session || !user) return new Response(null, { status: 401 });
  const denied = staffMenuApiForbidden(user, request.nextUrl.pathname);
  if (denied) return denied;
  const params = await segmentData.params;
  if (!params.id) return NextResponse.json("Bad request", { status: 400 });
  try {
    const router = await getRouterForUser(parseInt(params.id), user);
    if (!router)
      return NextResponse.json("Router tidak ditemukan atau akses ditolak", { status: 403 });

    const ppp = await withRouterOsClient(
      await routerToCredentialsWithHostPolicy(router),
      `ppp-secret:${router.id}`,
      async (api) => api.write("/ppp/secret/print")
    );
    if (!ppp) return NextResponse.json(ppp, { status: 404 });
    return NextResponse.json(
      redactPppPasswordsUnlessSuperadmin(ppp, user.role)
    );
  } catch (err) {
    return errorApiResponse(err);
  }
}
