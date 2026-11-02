import { validateRequest } from "@/lib/auth";
import { staffMenuApiForbidden } from "@/lib/staff-menu-api";
import { routerManageApiForbidden } from "@/lib/router-manage-access";
import { resolveMikrotikProxyConnectHost } from "@/lib/router-host-policy";
import {
  probeRouterOsCredentials,
  userFacingRouterOsConnectError,
} from "@/lib/routeros-connect-verify";
import { errorApiResponse } from "@/lib/server-actions/api";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const DetectSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().positive(),
  user: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const { session, user } = await validateRequest();
    if (!session || !user) {
      return NextResponse.json({ error: "Tidak terotentikasi" }, { status: 401 });
    }

    const denied = staffMenuApiForbidden(user, request.nextUrl.pathname);
    if (denied) return denied;

    const manageDenied = routerManageApiForbidden(user);
    if (manageDenied) return manageDenied;

    const body = DetectSchema.safeParse(await request.json());
    if (!body.success) {
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
    }

    try {
      const connectHost = await resolveMikrotikProxyConnectHost(body.data.host);
      const detected = await probeRouterOsCredentials(
        { ...body.data, host: connectHost },
        `detect-version:${body.data.host}:${body.data.port}`,
        { detectVersion: true }
      );
      if (!detected) {
        return NextResponse.json(
          { error: "Versi RouterOS tidak dikenali dari router ini" },
          { status: 400 }
        );
      }
      return NextResponse.json({
        data: detected,
        message: "Versi RouterOS terdeteksi",
      });
    } catch (connErr) {
      return NextResponse.json(
        { error: userFacingRouterOsConnectError(connErr) },
        { status: 400 }
      );
    }
  } catch (err) {
    return errorApiResponse(err);
  }
}
