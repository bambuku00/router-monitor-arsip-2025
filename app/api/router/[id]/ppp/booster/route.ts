import { validateRequest } from "@/lib/auth";
import { assertStaffMayMutatePppSecret, getRouterForUser } from "@/lib/authz";
import { applyPppBooster } from "@/lib/ppp-booster-apply";
import { loadRouterCredentials } from "@/lib/ppp-isolir-service";
import prisma from "@/lib/prisma";
import { errorApiResponse } from "@/lib/server-actions/api";
import { staffMenuApiForbidden } from "@/lib/staff-menu-api";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  const { user, session } = await validateRequest();
  if (!session || !user) return new Response(null, { status: 401 });
  const denied = staffMenuApiForbidden(user, request.nextUrl.pathname);
  if (denied) return denied;
  if (user.role !== "Superadmin") {
    return NextResponse.json(
      { error: "Booster hanya untuk Superadmin" },
      { status: 403 }
    );
  }

  const params = await segmentData.params;
  const routerId = parseInt(params.id);
  if (!Number.isInteger(routerId) || routerId <= 0) {
    return NextResponse.json({ error: "Router tidak valid" }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
    paketId?: unknown;
    days?: unknown;
  } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const paketId = typeof body?.paketId === "number" ? body.paketId : Number(body?.paketId);
  const days = typeof body?.days === "number" ? body.days : Number(body?.days);
  if (!name || !Number.isInteger(paketId) || paketId <= 0 || !Number.isInteger(days)) {
    return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
  }

  const router = await getRouterForUser(routerId, user);
  if (!router) {
    return NextResponse.json(
      { error: "Router tidak ditemukan atau akses ditolak" },
      { status: 403 }
    );
  }

  const creds = await loadRouterCredentials(routerId);
  if (!creds || router.userId == null) {
    return NextResponse.json({ error: "Router tidak ditemukan" }, { status: 404 });
  }

  const secret = await prisma.pppSecret.findUnique({
    where: { routerId_name: { routerId, name } },
    select: {
      id: true,
      name: true,
      routerId: true,
      on_router: true,
      isIsolir: true,
      disabled: true,
      profile: true,
      profileBeforeIsolir: true,
      pelanggan: {
        select: {
          id: true,
          stop: true,
          paket: { select: { id: true, nama: true, kapasitas: true, harga: true } },
        },
      },
    },
  });
  if (!secret) {
    return NextResponse.json({ error: "PPP tidak ditemukan" }, { status: 404 });
  }

  const scoped = await assertStaffMayMutatePppSecret(user, secret);
  if (!scoped.ok) {
    return NextResponse.json({ error: scoped.error }, { status: scoped.status });
  }
  if (!secret.pelanggan) {
    return NextResponse.json(
      { error: "Isi data pelanggan dulu sebelum booster" },
      { status: 400 }
    );
  }

  const target = await prisma.paket.findFirst({
    where: { id: paketId, userId: router.userId, deleted: false },
    select: { id: true, nama: true, kapasitas: true, harga: true },
  });
  if (!target) {
    return NextResponse.json(
      { error: "Paket tidak ditemukan pada mitra ini" },
      { status: 404 }
    );
  }

  try {
    const result = await applyPppBooster({
      router: creds,
      ownerUserId: router.userId,
      secret,
      pelanggan: secret.pelanggan,
      target,
      days,
      actorUserId: user.id,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({
      secretId: secret.id,
      profile: result.profile,
      kicked: result.kicked,
      kickPermissionDenied: result.kickPermissionDenied,
      direction: "booster" as const,
      days: result.days,
      booster: {
        profile: result.profile,
        days: result.days,
        endsAt: result.endsAt.toISOString(),
      },
      paket: {
        id: secret.pelanggan.paket.id,
        nama: secret.pelanggan.paket.nama,
        kapasitas: secret.pelanggan.paket.kapasitas,
        harga: secret.pelanggan.paket.harga,
      },
    });
  } catch (err) {
    return errorApiResponse(err, 400);
  }
}
