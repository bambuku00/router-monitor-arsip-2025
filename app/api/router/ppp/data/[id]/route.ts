import { validateRequest } from "@/lib/auth";
import {
  assertScopedStaffMayUseRouterLevelPpp,
  getRouterForUser,
} from "@/lib/authz";
import { staffMenuApiForbidden } from "@/lib/staff-menu-api";
import prisma from "@/lib/prisma";
import { redactPasswordFields } from "@/lib/ppp-password-redact";
import { errorApiResponse } from "@/lib/server-actions/api";
import { NextRequest, NextResponse } from "next/server";
import { routerToCredentialsWithHostPolicy, withRouterOsClient } from "@/lib/routeros-session";
import { PPPActive, PPPSecret } from "@/lib/router-types";
import { Prisma, Service } from "@prisma/client";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  const { user, session } = await validateRequest();
  if (!session || !user) return new Response(null, { status: 401 });
  const denied = staffMenuApiForbidden(user, request.nextUrl.pathname);
  if (denied) return denied;
  const scoped = await assertScopedStaffMayUseRouterLevelPpp(user);
  if (!scoped.ok) {
    return NextResponse.json({ error: scoped.error }, { status: scoped.status });
  }
  const params = await segmentData.params;
  if (!params.id) return NextResponse.json("Bad request", { status: 400 });
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) return NextResponse.json("Invalid ID", { status: 400 });

    const router = await getRouterForUser(id, user);
    if (!router)
      return NextResponse.json("Router tidak ditemukan atau akses ditolak", { status: 403 });

    const { pppActive, pppSecret } = await withRouterOsClient(
      await routerToCredentialsWithHostPolicy(router),
      `ppp-data-sync:${router.id}`,
      async (api) => {
        const pppActive = (await api.write("/ppp/active/print")) as PPPActive[];
        const pppSecret = (await api.write("/ppp/secret/print")) as PPPSecret[];
        return { pppActive, pppSecret };
      }
    );

    const existedActive = await prisma.pppActive.findMany({
      where: {
        routerId: router.id,
      },
    });
    const secretPromises: Prisma.PrismaPromise<any>[] = [];
    for (const val of pppSecret) {
      const data = {
        callerId: val["caller-id"],
        comment: val.comment,
        disabled: val.disabled,
        ipv6_routes: val["ipv6-routes"],
        last_callerId: val["last-caller-id"],
        last_disconnect_reason: val["last-disconnect-reason"],
        last_logged_out: val["last-logged-out"],
        limit_bytes_in: val["limit-bytes-in"],
        limit_bytes_out: val["limit-bytes-out"],
        name: val.name,
        password: val.password,
        profile: val.profile,
        routerId: router.id,
        routes: val.routes,
        secretId: val[".id"],
        service: val.service as Service,
      };
      const activeRecordsExist = existedActive.find(
        (actVal) => actVal.name === val.name
      );
      secretPromises.push(
        prisma.pppSecret.upsert({
          where: { routerId_name: { routerId: router.id, name: val.name } },
          create: data,
          update: {
            ...data,
            ...(activeRecordsExist
              ? {
                  active_records: { delete: true },
                }
              : {}),
          },
        })
      );
    }
    const activePromises: Prisma.PrismaPromise<any>[] = [];
    for (const val of pppActive) {
      const data = {
        activeId: val[".id"],
        address: val.address,
        callerId: val["caller-id"],
        comment: val.comment,
        encoding: val.encoding,
        limit_bytes_in: val["limit-bytes-in"],
        limit_bytes_out: val["limit-bytes-out"],
        name: val.name,
        radius: val.radius,
        routerId: router.id,
        service: val.service as Service,
        sessionId: val["session-id"],
        uptime: val.uptime,
      };
      activePromises.push(
        prisma.pppActive.upsert({
          where: { routerId_name: { routerId: router.id, name: val.name } },
          create: data,
          update: data,
        })
      );
    }
    const transactions = await prisma.$transaction([
      ...secretPromises,
      ...activePromises,
    ]);
    const syncTime = await prisma.pppSync.upsert({
      where: { routerId: router.id },
      create: { routerId: router.id },
      update: { routerId: router.id, updated: new Date() },
    });
    const json = {
      addTotal: secretPromises.length,
      transactions: redactPasswordFields(transactions),
      syncTime,
    };
    if (!json) return NextResponse.json(json, { status: 404 });
    return NextResponse.json(json);
  } catch (err) {
    return errorApiResponse(err);
  }
}
