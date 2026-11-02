import { hash } from "argon2";
import { validateRequest } from "@/lib/auth";
import { getPelangganInScope } from "@/lib/authz";
import { revokePelangganPortalSessions } from "@/lib/pelanggan-portal";
import { normalizePortalPin, portalPinError } from "@/lib/portal-slug";
import prisma from "@/lib/prisma";
import { staffMenuApiForbidden } from "@/lib/staff-menu-api";
import { NextRequest, NextResponse } from "next/server";

const ARGON2_OPTS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function POST(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  const { session, user } = await validateRequest();
  if (!session || !user) return new Response(null, { status: 401 });
  const denied = staffMenuApiForbidden(user, request.nextUrl.pathname);
  if (denied) return denied;

  const params = await segmentData.params;
  const secretId = parseInt(params.id, 10);
  if (!Number.isInteger(secretId)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  let body: { mode?: unknown; pin?: unknown };
  try {
    body = (await request.json()) as { mode?: unknown; pin?: unknown };
  } catch {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }
  const mode = body.mode === "mitra" || body.mode === "set" ? body.mode : null;
  if (!mode) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const existing = await prisma.pelanggan.findUnique({
    where: { ppp_secretId: secretId },
    select: { id: true },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "Pelanggan tidak ditemukan" },
      { status: 404 }
    );
  }
  const inScope = await getPelangganInScope(existing.id, user);
  if (!inScope) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  if (mode === "mitra") {
    await prisma.pelanggan.update({
      where: { id: existing.id },
      data: { portalPinHash: null },
    });
    revokePelangganPortalSessions(existing.id);
    return NextResponse.json({ pinSendiri: false });
  }

  const pin = normalizePortalPin(
    typeof body.pin === "string" ? body.pin.slice(0, 32) : ""
  );
  const pinErr = portalPinError(pin);
  if (!pin || pinErr) {
    return NextResponse.json(
      { error: pinErr || "Isi PIN baru." },
      { status: 400 }
    );
  }

  await prisma.pelanggan.update({
    where: { id: existing.id },
    data: { portalPinHash: await hash(pin, ARGON2_OPTS) },
  });
  revokePelangganPortalSessions(existing.id);
  return NextResponse.json({ pinSendiri: true });
}
