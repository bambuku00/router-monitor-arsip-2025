import { validateRequest } from "@/lib/auth";
import {
  assertStaffMayMutatePppSecret,
  getRouterForUser,
} from "@/lib/authz";
import { canStaffManageIsolir } from "@/lib/rbac";
import { isPppIsolir } from "@/lib/ppp-isolir";
import {
  loadRouterCredentials,
  togglePppIsolir,
} from "@/lib/ppp-isolir-service";
import { recordManualIsolirLog } from "@/lib/manual-isolir-log";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { errorApiResponse } from "@/lib/server-actions/api";
import { NextRequest, NextResponse } from "next/server";
import { staffMenuApiForbidden } from "@/lib/staff-menu-api";

export const dynamic = "force-dynamic";

async function handleToggleIsolir(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string; name: string }> }
) {
  const { user, session } = await validateRequest();
  if (!session || !user) return new Response(null, { status: 401 });
  const denied = staffMenuApiForbidden(user, request.nextUrl.pathname);
  if (denied) return denied;
  if (!canStaffManageIsolir(user)) {
    return NextResponse.json(
      { error: "Staff tidak diizinkan melakukan isolir" },
      { status: 403 }
    );
  }
  const params = await segmentData.params;
  if (!params.id) return NextResponse.json("Bad request", { status: 400 });

  const routerId = parseInt(params.id);
  const router = await getRouterForUser(routerId, user);
  const name = params.name;

  if (!name) return NextResponse.json("Bad request", { status: 400 });
  if (!router)
    return NextResponse.json("Router tidak ditemukan atau akses ditolak", {
      status: 403,
    });

  const routerConfig = await loadRouterCredentials(routerId);
  if (!routerConfig) {
    return NextResponse.json("Router tidak ditemukan", { status: 404 });
  }

  const ppp = await prisma.pppSecret.findUnique({
    where: { routerId_name: { routerId, name } },
    include: { active_records: true },
  });

  if (!ppp) return NextResponse.json("PPP tidak ditemukan", { status: 400 });

  const scoped = await assertStaffMayMutatePppSecret(user, ppp);
  if (!scoped.ok) {
    return NextResponse.json({ error: scoped.error }, { status: scoped.status });
  }

  const currentlyIsolir = isPppIsolir(ppp, {
    isolirProfileName: routerConfig.isolirProfileName,
  });
  const applyingIsolir = !currentlyIsolir;

  const noteIsolirActor = async (result: {
    oldProfile?: string;
    newProfile?: string;
  }) => {
    try {
      await recordManualIsolirLog({
        actor: user,
        routerUserId: router.userId,
        pppSecretId: ppp.id,
        pppUsername: ppp.name,
        routerId,
        action: applyingIsolir ? "isolate" : "restore",
        oldProfile: result.oldProfile,
        newProfile: result.newProfile,
      });
    } catch (err) {
      logger.warn({
        msg: "Gagal mencatat pelaku isolir manual",
        routerId,
        ppp: ppp.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  };

  if (applyingIsolir && !routerConfig.isolirProfileName?.trim()) {
    return NextResponse.json(
      {
        error:
          "Setup isolir belum dilakukan. Jalankan Setup Isolir terlebih dahulu.",
      },
      { status: 400 }
    );
  }

  if (
    !applyingIsolir &&
    !ppp.profileBeforeIsolir &&
    ppp.disabled === "true"
  ) {
    const legacy = await togglePppIsolir({ router: routerConfig, ppp });
    if (!legacy.ok) {
      return NextResponse.json({ error: legacy.error }, { status: 400 });
    }
    if (!legacy.skipped) await noteIsolirActor(legacy);
    return NextResponse.json({ permissionDenied: legacy.permissionDenied }, { status: 200 });
  }

  try {
    const result = await togglePppIsolir({ router: routerConfig, ppp });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    if (!result.skipped) await noteIsolirActor(result);
    return NextResponse.json({ permissionDenied: result.permissionDenied }, { status: 200 });
  } catch (err) {
    logger.error(err as Error);
    return errorApiResponse(err, 400);
  }
}

/** Mutasi isolir hanya via POST (hindari CSRF lewat GET + SameSite=lax). */
export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string; name: string }> }
) {
  return handleToggleIsolir(request, segmentData);
}
