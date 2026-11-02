import { validateRequest } from "@/lib/auth";
import { getRouterForUser } from "@/lib/authz";
import {
  applyIsolirSetup,
  type IsolirRosType,
  normalizeGatewayIp,
  normalizeProfileName,
} from "@/lib/mikrotik/isolir-setup";
import { logger } from "@/lib/logger";
import { mapRouterOsVersionString } from "@/lib/routeros-version";
import prisma from "@/lib/prisma";
import { staffMenuApiForbidden } from "@/lib/staff-menu-api";
import { requireRouterManageById } from "@/lib/router-manage-access";
import { errorApiResponse } from "@/lib/server-actions/api";
import { routerToCredentialsWithHostPolicy, withRouterOsClient } from "@/lib/routeros-session";
import { SystemResource } from "@/lib/router-types";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const BodySchema = z.object({
  rosType: z.enum(["ros6", "ros7"]).optional(),
  gatewayIp: z.string().optional(),
  profileName: z.string().optional(),
  saveProfileOnly: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  const { session, user } = await validateRequest();
  if (!session || !user) {
    return NextResponse.json({ error: "Tidak terotentikasi" }, { status: 401 });
  }

  const denied = staffMenuApiForbidden(user, request.nextUrl.pathname);
  if (denied) return denied;

  const params = await segmentData.params;
  const routerId = parseInt(params.id, 10);
  if (!params.id || Number.isNaN(routerId)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const router = await getRouterForUser(routerId, user);
  if (!router) {
    return NextResponse.json(
      { error: "Router tidak ditemukan atau akses ditolak" },
      { status: 403 }
    );
  }

  const record = await prisma.router.findUnique({
    where: { id: routerId },
    select: {
      isolirProfileName: true,
      isolirGatewayIp: true,
      isolirRosType: true,
      isolirConfiguredAt: true,
    },
  });

  return NextResponse.json({
    data: {
      isolirProfileName: record?.isolirProfileName ?? null,
      isolirGatewayIp: record?.isolirGatewayIp ?? null,
      isolirRosType: record?.isolirRosType ?? null,
      isolirConfiguredAt: record?.isolirConfiguredAt ?? null,
    },
  });
}

export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  const { session, user } = await validateRequest();
  if (!session || !user) {
    return NextResponse.json({ error: "Tidak terotentikasi" }, { status: 401 });
  }

  const denied = staffMenuApiForbidden(user, request.nextUrl.pathname);
  if (denied) return denied;

  const params = await segmentData.params;
  const routerId = parseInt(params.id, 10);
  if (!params.id || Number.isNaN(routerId)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const access = await requireRouterManageById(user, routerId);
  if (!access.ok) return access.response;

  const parsed = BodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  let profileName: string;
  try {
    profileName = normalizeProfileName(parsed.data.profileName);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  if (parsed.data.saveProfileOnly) {
    try {
      await prisma.router.update({
        where: { id: routerId },
        data: { isolirProfileName: profileName },
      });
      return NextResponse.json({
        message: "Nama profil isolir tersimpan",
        data: { profileName, saveProfileOnly: true },
      });
    } catch (err) {
      logger.error({ msg: "Isolir profile name save failed", routerId, error: err });
      return errorApiResponse(err, 400);
    }
  }

  if (!parsed.data.gatewayIp?.trim()) {
    return NextResponse.json(
      { error: "IP gateway wajib diisi untuk proses ke Mikrotik" },
      { status: 400 }
    );
  }

  const rosType: IsolirRosType | null =
    access.router.os_version === "v7"
      ? "ros7"
      : access.router.os_version === "v6"
        ? "ros6"
        : null;
  if (!rosType) {
    return NextResponse.json(
      { error: "Versi RouterOS belum tercatat di data router" },
      { status: 400 }
    );
  }

  let gatewayIp: string;
  try {
    gatewayIp = normalizeGatewayIp(parsed.data.gatewayIp);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  const router = access.router;

  const apiResult = await withRouterOsClient(
    await routerToCredentialsWithHostPolicy(router),
    `isolir-setup:${routerId}`,
    async (api) => {
      const resourceRows = (await api.write("/system/resource/print")) as unknown;
      const resource = (
        Array.isArray(resourceRows) ? resourceRows[0] : undefined
      ) as SystemResource | undefined;
      const detectedOs = mapRouterOsVersionString(resource?.version ?? "");

      if (detectedOs && detectedOs !== (rosType === "ros7" ? "v7" : "v6")) {
        logger.warn({
          msg: "Isolir setup ROS type mismatch",
          routerId,
          selected: rosType,
          detected: detectedOs,
        });
      }

      const result = await applyIsolirSetup(api, {
        rosType,
        gatewayIp,
        profileName,
      });

      return { result, detectedOs, rosType };
    }
  );

  try {
    await prisma.router.update({
      where: { id: routerId },
      data: {
        isolirProfileName: profileName,
        isolirGatewayIp: gatewayIp,
        isolirRosType: apiResult.rosType,
        isolirConfiguredAt: new Date(),
      },
    });

    return NextResponse.json({
      message: "Setup isolir selesai",
      data: {
        ...apiResult.result,
        profileName,
        gatewayIp,
        rosType: apiResult.rosType,
        detectedOs: apiResult.detectedOs,
      },
    });
  } catch (err) {
    logger.error({ msg: "Isolir setup failed", routerId, error: err });
    return errorApiResponse(err, 400);
  }
}
