import { validateRequest } from "@/lib/auth";
import { staffMenuApiForbidden } from "@/lib/staff-menu-api";
import { deleteRoutersOperationalInTransaction } from "@/lib/delete-router-operational";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  probeRouterOsCredentials,
  userFacingRouterOsConnectError,
} from "@/lib/routeros-connect-verify";
import { resolveMikrotikProxyConnectHost } from "@/lib/router-host-policy";
import { errorApiResponse } from "@/lib/server-actions/api";
import { sanitizeRouterForClient } from "@/lib/api-sanitize";
import { encryptRouterPasswordForStorage } from "@/lib/routeros-session";
import {
  requireRouterManageById,
  routerManageApiForbidden,
} from "@/lib/router-manage-access";
import { decryptRouterPassword } from "@/lib/router-password-crypto";
import { RouterOptionalDefaultsSchema as Schema } from "@/prisma/generated/zod";
import { Router } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

/** PUT: password boleh kosong = pertahankan password tersimpan. */
const RouterPutSchema = Schema.extend({
  password: z.string().optional(),
});

export async function PUT(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  const { session, user } = await validateRequest();
  if (!session || !user)
    return NextResponse.json({ error: "Tidak terotentikasi" }, { status: 401 });

  const deniedPut = staffMenuApiForbidden(user, request.nextUrl.pathname);
  if (deniedPut) return deniedPut;

  const params = await segmentData.params;
  const id = parseInt(params.id);
  if (!params.id)
    return NextResponse.json(
      { error: "Permintaan tidak valid" },
      { status: 400 }
    );

  const manageDeniedPut = routerManageApiForbidden(user);
  if (manageDeniedPut) return manageDeniedPut;

  const access = await requireRouterManageById(user, id);
  if (!access.ok) return access.response;
  const router = access.router;

  const json = (await request.json()) as Router | null;
  if (json && json.pppProfileBackup == null) {
    json.pppProfileBackup = null;
  }
  const parseSchema = RouterPutSchema.safeParse(json);
  if (!json || !parseSchema.success)
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });

  try {
    const passwordPlain =
      typeof json.password === "string" && json.password.trim().length > 0
        ? json.password.trim()
        : decryptRouterPassword(router.password);

    const connectHost = await resolveMikrotikProxyConnectHost(json.host);
    const detected = await probeRouterOsCredentials(
      {
        host: connectHost,
        port: json.port,
        user: json.user,
        password: passwordPlain,
      },
      `router-update:${id}`,
      { detectVersion: !json.os_version }
    );

    const { userId: _userId, password: _pw, pppProfileBackup: _backup, ...data } = json;
    void _userId;
    void _pw;
    void _backup;
    const put = await prisma.router.update({
      where: { id },
      data: {
        ...data,
        password: encryptRouterPasswordForStorage(passwordPlain),
        os_version: json.os_version || detected?.os_version || null,
      },
    });
    return NextResponse.json({
      data: sanitizeRouterForClient(put),
      message: `Router ${data.nama} berhasil diubah`,
    });
  } catch (err) {
    logger.error({
      msg: "RouterOS verify gagal (PUT router)",
      host: json.host,
      port: json.port,
      error: err instanceof Error ? err.message : err,
    });
    return NextResponse.json(
      { error: userFacingRouterOsConnectError(err) },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  try {
    const { session, user } = await validateRequest();
    if (!session || !user) {
      return NextResponse.json({ error: "Tidak terotentikasi" }, { status: 401 });
    }

    const deniedDel = staffMenuApiForbidden(user, request.nextUrl.pathname);
    if (deniedDel) return deniedDel;

    const manageDeniedDel = routerManageApiForbidden(user);
    if (manageDeniedDel) return manageDeniedDel;

    const params = await segmentData.params;
    const id = parseInt(params.id, 10);
    if (!params.id || Number.isNaN(id)) {
      return NextResponse.json(
        { error: "Permintaan tidak valid" },
        { status: 400 }
      );
    }

    const access = await requireRouterManageById(user, id);
    if (!access.ok) return access.response;
    const routerRow = access.router;

    await prisma.$transaction(async (tx) => {
      await deleteRoutersOperationalInTransaction(tx, [id]);
    });

    return NextResponse.json({
      message: `Router "${routerRow.nama}" dan data pelanggan/PPP/pembayaran terkait berhasil dihapus.`,
    });
  } catch (err) {
    return errorApiResponse(err);
  }
}
