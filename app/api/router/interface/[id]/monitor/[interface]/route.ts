import { validateRequest } from "@/lib/auth";
import { getRouterForUser } from "@/lib/authz";
import { staffMenuApiForbiddenFromRequestUrl } from "@/lib/staff-menu-api";
import { errorApiResponse } from "@/lib/server-actions/api";
import { NextResponse } from "next/server";
import { routerToCredentialsWithHostPolicy, withRouterOsClient } from "@/lib/routeros-session";

export const dynamic = "force-dynamic";
export async function GET(
  request: Request,
  segmentData: { params: Promise<{ id: string; interface: string }> }
) {
  const { session, user } = await validateRequest();
  if (!session || !user) return new Response(null, { status: 401 });
  const denied = staffMenuApiForbiddenFromRequestUrl(user, request.url);
  if (denied) return denied;
  const params = await segmentData.params;
  if (!params.id) return NextResponse.json("Bad request", { status: 400 });
  try {
    const router = await getRouterForUser(parseInt(params.id), user);
    if (!router)
      return NextResponse.json("Router tidak ditemukan atau akses ditolak", { status: 403 });

    const interfaceName = decodeURIComponent(params.interface ?? "");
    if (!interfaceName) return NextResponse.json("Bad request", { status: 400 });

    const normalized = await withRouterOsClient(
      await routerToCredentialsWithHostPolicy(router),
      `interface-monitor:${router.id}:${interfaceName}`,
      async (api) => {
        const replies = await api.getInterfaceStats(interfaceName);
        const list = Array.isArray(replies) ? replies : [];
        return list.map((reply: unknown) => {
          const r = (reply ?? {}) as Record<string, unknown>;
          const tx = r["tx-byte"] ?? r.tx ?? 0;
          const rx = r["rx-byte"] ?? r.rx ?? 0;
          return { tx: String(tx), rx: String(rx) };
        });
      }
    );

    return NextResponse.json(normalized.length > 0 ? normalized : [{ tx: "0", rx: "0" }]);
  } catch (err) {
    return errorApiResponse(err);
  }
}
