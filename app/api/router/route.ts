import { validateRequest } from "@/lib/auth";
import { getOwnedResourcesUserId } from "@/lib/rbac";
import { staffMenuApiForbidden } from "@/lib/staff-menu-api";
import prisma from "@/lib/prisma";
import { RouterOptionalDefaultsSchema as RouterSchema } from "@/prisma/generated/zod";
import { errorApiResponse } from "@/lib/server-actions/api";
import { logger } from "@/lib/logger";
import { Router } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import {
  probeRouterOsCredentials,
  userFacingRouterOsConnectError,
} from "@/lib/routeros-connect-verify";
import { resolveMikrotikProxyConnectHost } from "@/lib/router-host-policy";
import { sanitizeRouterForClient, sanitizeRoutersForClient } from "@/lib/api-sanitize";
import { encryptRouterPasswordForStorage } from "@/lib/routeros-session";
import {
  routerListPrismaSelect,
  routerManageApiForbidden,
} from "@/lib/router-manage-access";

export async function GET(request: NextRequest) {
  try {
    const { user, session } = await validateRequest();
    if (!session || !user) return NextResponse.json({ error: "Tidak terotentikasi" }, { status: 401 });

    const denied = staffMenuApiForbidden(user, request.nextUrl.pathname);
    if (denied) return denied;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "1000"); // Default besar agar dropdown tidak rusak
    const skip = (page - 1) * limit;

    const listSelect = routerListPrismaSelect(user.role);

    const [routers, total] = await prisma.$transaction([
      prisma.router.findMany({
      where: {
        deleted: false,
        ...(user.role !== "Superadmin"
          ? { userId: getOwnedResourcesUserId(user) }
          : {}),
      },
      orderBy: {
        created: "desc",
      },
      select: listSelect,
      take: limit,
      skip: skip,
    }),
    prisma.router.count({
      where: {
        deleted: false,
        ...(user.role !== "Superadmin"
          ? { userId: getOwnedResourcesUserId(user) }
          : {}),
      },
    })
  ]);

    return NextResponse.json({
      data: routers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      message: "Berhasil mendapatkan routers user",
    });
  } catch (err) {
    return errorApiResponse(err);
  }
}
export async function POST(request: NextRequest) {
  try {
    const { session, user } = await validateRequest();
    if (!session || !user) return NextResponse.json({ error: "Tidak terotentikasi" }, { status: 401 });
    const denied = staffMenuApiForbidden(user, request.nextUrl.pathname);
    if (denied) return denied;
    const manageDenied = routerManageApiForbidden(user);
    if (manageDenied) return manageDenied;
    const data = (await request.json()) as Router | null;
    if (data && data.pppProfileBackup == null) {
      data.pppProfileBackup = null;
    }
    const parseSchema = RouterSchema.safeParse(data);
    if (!data || !parseSchema.success) {
      logger.error({
        msg: "Validation error",
        error: parseSchema.error?.flatten(),
      });
      return NextResponse.json(
        {
          error: "Data tidak valid",
          details: parseSchema.error?.flatten(),
        },
        { status: 400 }
      );
    }

    const existingRouter = await prisma.router.findFirst({
      where: {
        host: data.host,
        port: data.port,
        deleted: false,
      },
    });

    if (existingRouter) {
      return NextResponse.json(
        { error: "Router dengan Host dan Port tersebut sudah terdaftar" },
        { status: 400 }
      );
    }

    let detectedVersion: { os_version: "v6" | "v7"; version: string } | null =
      null;
    try {
      const connectHost = await resolveMikrotikProxyConnectHost(data.host);
      detectedVersion = await probeRouterOsCredentials(
        {
          host: connectHost,
          port: data.port,
          user: data.user,
          password: data.password,
        },
        `router-create:${data.host}:${data.port}`,
        { detectVersion: !data.os_version }
      );
    } catch (connErr) {
      logger.error({
        msg: "RouterOS connection failed",
        host: data.host,
        port: data.port,
        error: connErr instanceof Error ? connErr.message : connErr,
      });
      return NextResponse.json(
        { error: userFacingRouterOsConnectError(connErr) },
        { status: 400 }
      );
    }

    // Non-Superadmin cannot assign router to another user; force ownership to prevent privilege escalation.
    const { pppProfileBackup: _backup, ...routerFields } = data;
    void _backup;
    const createData = {
      ...routerFields,
      password: encryptRouterPasswordForStorage(data.password),
      os_version: data.os_version || detectedVersion?.os_version || null,
      userId:
        user.role === "Superadmin" ? data.userId : getOwnedResourcesUserId(user),
    };
    const post = await prisma.router.create({
      data: createData,
    });
    return NextResponse.json({
      data: sanitizeRouterForClient(post),
      message: "Berhasil menambah router",
    });
  } catch (err) {
    const error = err as Error;

    // Check for specific, safe-to-expose errors
    if (
      error.name === "RosException" &&
      "errno" in error &&
      (error as Error & { errno: string }).errno === "CANTLOGIN"
    ) {
      logger.error({
        msg: "Router connection error: Auth failed",
        error: error.message,
      });
      return NextResponse.json(
        { error: "Username atau password RouterOS salah" },
        { status: 400 }
      );
    }

    return errorApiResponse(err);
  }
}
