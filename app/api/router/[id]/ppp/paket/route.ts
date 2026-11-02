import { validateRequest } from "@/lib/auth";
import { assertStaffMayMutatePppSecret, getRouterForUser } from "@/lib/authz";
import {
  assertFreeCustomerQuotaAllowed,
  freeCustomerQuotaErrorResponse,
} from "@/lib/free-customer-quota";
import { applyPppPackageChange } from "@/lib/ppp-package-change-apply";
import { checkPppPackageChangeQuota } from "@/lib/ppp-package-change-quota";
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

  const params = await segmentData.params;
  const routerId = parseInt(params.id);
  if (!Number.isInteger(routerId) || routerId <= 0) {
    return NextResponse.json({ error: "Router tidak valid" }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
    paketId?: unknown;
    direction?: unknown;
  } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const paketId = typeof body?.paketId === "number" ? body.paketId : Number(body?.paketId);
  const direction = body?.direction === "upgrade" || body?.direction === "downgrade"
    ? body.direction
    : null;
  if (!name || !Number.isInteger(paketId) || paketId <= 0 || !direction) {
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
  const ownerUserId = router.userId;

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
          nama: true,
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
      { error: "Isi data pelanggan dulu sebelum ganti paket" },
      { status: 400 }
    );
  }

  const target = await prisma.paket.findFirst({
    where: { id: paketId, userId: ownerUserId, deleted: false },
    select: { id: true, nama: true, kapasitas: true, harga: true },
  });
  if (!target) {
    return NextResponse.json(
      { error: "Paket tidak ditemukan pada mitra ini" },
      { status: 404 }
    );
  }

  try {
    await assertFreeCustomerQuotaAllowed({
      ownerUserId,
      paketHarga: target.harga,
      excludePelangganId: secret.pelanggan.id,
    });
  } catch (err) {
    const quota = freeCustomerQuotaErrorResponse(err);
    if (quota) {
      return NextResponse.json({ error: quota.message }, { status: quota.status });
    }
    return errorApiResponse(err, 400);
  }

  if (user.role !== "Superadmin") {
    const quota = await checkPppPackageChangeQuota(ownerUserId, direction);
    if (!quota.ok) {
      return NextResponse.json({ error: quota.error }, { status: 403 });
    }
  }

  try {
    const result = await applyPppPackageChange({
      router: creds,
      ownerUserId,
      secret,
      pelanggan: secret.pelanggan,
      target,
      direction,
      actor: {
        id: user.id,
        role: user.role,
        nama: user.nama,
        user: user.user,
      },
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({
      secretId: secret.id,
      profile: result.profile,
      kicked: result.kicked,
      kickPermissionDenied: result.kickPermissionDenied,
      direction,
      paket: result.paket,
    });
  } catch (err) {
    return errorApiResponse(err, 400);
  }
}
