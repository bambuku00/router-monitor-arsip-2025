import { validateRequest } from "@/lib/auth";
import {
  assertScopedStaffMayUseRouterLevelPpp,
  getRouterForUser,
} from "@/lib/authz";
import { staffMenuApiForbidden } from "@/lib/staff-menu-api";
import { errorApiResponse } from "@/lib/server-actions/api";
import { logger } from "@/lib/logger";
import { validatePPPAdd } from "@/lib/ppp-validate";
import { NextRequest, NextResponse } from "next/server";
import { routerToCredentialsWithHostPolicy, withRouterOsClient } from "@/lib/routeros-session";

export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  const { session, user } = await validateRequest();
  if (!session || !user) return new Response(null, { status: 401 });

  const denied = staffMenuApiForbidden(user, request.nextUrl.pathname);
  if (denied) return denied;

  const scoped = await assertScopedStaffMayUseRouterLevelPpp(user);
  if (!scoped.ok) {
    return NextResponse.json({ error: scoped.error }, { status: scoped.status });
  }

  const params = await segmentData.params;
  const id = parseInt(params.id);
  if (isNaN(id)) return NextResponse.json("Invalid ID", { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json("Invalid JSON body", { status: 400 });
  }

  const validated = validatePPPAdd(body);
  if (!validated.success) {
    return NextResponse.json(validated.error, { status: 400 });
  }

  const { name, password, profile, service, comment, localAddress, remoteAddress } = validated.data;

  try {
    const router = await getRouterForUser(id, user);
    if (!router) {
      return NextResponse.json("Router tidak ditemukan atau akses ditolak", { status: 403 });
    }

    try {
      await withRouterOsClient(
        await routerToCredentialsWithHostPolicy(router),
        `ppp-add:${router.id}:${name}`,
        async (api) => {
          const existing = await api.write(["/ppp/secret/print", `?name=${name}`]);
          if (existing.length > 0) {
            throw new Error("USER_EXISTS");
          }

          const addData: string[] = [
            "/ppp/secret/add",
            `=name=${name}`,
            `=password=${password}`,
            `=service=${service ?? "any"}`,
            `=profile=${profile ?? "default"}`,
          ];

          if (comment?.trim()) addData.push(`=comment=${comment.trim()}`);
          if (localAddress?.trim()) addData.push(`=local-address=${localAddress.trim()}`);
          if (remoteAddress?.trim()) addData.push(`=remote-address=${remoteAddress.trim()}`);

          await api.write(addData);
        }
      );
    } catch (apiError) {
      const error = apiError as Error;
      if (error.message === "USER_EXISTS") {
        return NextResponse.json("User PPP with this name already exists", { status: 409 });
      }
      logger.error({ msg: "RouterOS API error", error: error.message });
      return NextResponse.json(error.message || "Failed to add PPP user on router", { status: 500 });
    }

    return NextResponse.json({ message: "Berhasil menambahkan user PPP" });
  } catch (err) {
    return errorApiResponse(err);
  }
}
