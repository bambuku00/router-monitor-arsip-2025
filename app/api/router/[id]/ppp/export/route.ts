import { validateRequest } from "@/lib/auth";
import {
  assertScopedStaffMayUseRouterLevelPpp,
  getRouterForUser,
} from "@/lib/authz";
import { buildPppBackupScript, pppBackupFilename } from "@/lib/ppp-backup-export";
import {
  parsePppProfileBackup,
  refreshPppProfileBackup,
} from "@/lib/ppp-profile-backup";
import prisma from "@/lib/prisma";
import { staffMenuApiForbidden } from "@/lib/staff-menu-api";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function jakartaDateStamp(date: Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function jakartaDateTime(date: Date): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export async function GET(
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
  const routerId = parseInt(params.id, 10);
  if (Number.isNaN(routerId)) {
    return NextResponse.json({ message: "Router tidak valid" }, { status: 400 });
  }

  const router = await getRouterForUser(routerId, user);
  if (!router) {
    return NextResponse.json(
      { message: "Router tidak ditemukan atau akses ditolak" },
      { status: 403 }
    );
  }

  const secrets = await prisma.pppSecret.findMany({
    where: { routerId, on_router: true },
    orderBy: { name: "asc" },
    select: {
      name: true,
      password: true,
      service: true,
      profile: true,
      comment: true,
      disabled: true,
      isIsolir: true,
      profileBeforeIsolir: true,
      pelanggan: {
        select: {
          nama: true,
          paket: { select: { nama: true } },
        },
      },
    },
  });

  const now = new Date();
  const liveProfiles = await refreshPppProfileBackup(router);
  const storedProfiles = liveProfiles ?? parsePppProfileBackup(router.pppProfileBackup);
  const savedAt = storedProfiles?.savedAt ? new Date(storedProfiles.savedAt) : null;
  const profileNote = liveProfiles
    ? "baru dibaca dari Mikrotik dan disimpan di billing"
    : storedProfiles
      ? `cadangan terakhir di billing${
          savedAt && !Number.isNaN(savedAt.getTime())
            ? `, ${jakartaDateTime(savedAt)}`
            : ""
        }`
      : "belum ada cadangan";
  const body = buildPppBackupScript({
    routerName: router.nama,
    exportedAt: jakartaDateTime(now),
    profiles: storedProfiles?.profiles ?? [],
    pools: storedProfiles?.pools ?? [],
    profileNote,
    secrets: secrets.map((secret) => ({
      name: secret.name,
      password: secret.password,
      service: secret.service,
      profile: secret.profile,
      comment: secret.comment,
      disabled: secret.disabled,
      isIsolir: secret.isIsolir,
      profileBeforeIsolir: secret.profileBeforeIsolir,
      pelangganNama: secret.pelanggan?.nama ?? null,
      paketNama: secret.pelanggan?.paket.nama ?? null,
    })),
  });

  const filename = pppBackupFilename(router.nama, jakartaDateStamp(now));
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
