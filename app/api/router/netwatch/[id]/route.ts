import { validateRequest } from "@/lib/auth";
import { getRouterForUser } from "@/lib/authz";
import { staffMenuApiForbidden } from "@/lib/staff-menu-api";
import { errorApiResponse } from "@/lib/server-actions/api";
import { NextRequest, NextResponse } from "next/server";
import { routerToCredentialsWithHostPolicy, withRouterOsClient } from "@/lib/routeros-session";
import type { ToolNetwatch } from "@/lib/router-types";

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

    const normalized = await withRouterOsClient(
        await routerToCredentialsWithHostPolicy(router),
      `netwatch:${router.id}`,
      async (api) => {
        const resp = await api.write("/tool/netwatch/print");
        const list = Array.isArray(resp) ? resp : [];
        return list.map((reply: unknown) => {
          const r = (reply ?? {}) as Record<string, unknown>;
          return {
            id: String(r[".id"] ?? r.id ?? ""),
            host: String(r.host ?? ""),
            timeout: String(r.timeout ?? ""),
            interval: String(r.interval ?? ""),
            since: String(r.since ?? ""),
            status: String(r.status ?? ""),
            upScript: String(r["up-script"] ?? r.upScript ?? ""),
            downScript: String(r["down-script"] ?? r.downScript ?? ""),
            disabled: r.disabled === "true" || r.disabled === true,
          } satisfies ToolNetwatch;
        });
      }
    );

    return NextResponse.json(normalized);
  } catch (err) {
    return errorApiResponse(err);
  }
}
