import { validateRequest } from "@/lib/auth";
import { lockedBersamaForMitra } from "@/lib/pelanggan-portal";
import prisma from "@/lib/prisma";
import {
  normalizePortalPin,
  normalizePortalSlug,
  normalizePortalWaCs,
  portalPinError,
  portalSlugError,
  portalWaCsError,
} from "@/lib/portal-slug";
import { hash } from "argon2";
import { NextRequest, NextResponse } from "next/server";
import { getOwnedResourcesUserId } from "@/lib/rbac";

const ARGON2_OPTS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

function canEditPortal(role: string) {
  return role === "Admin" || role === "Superadmin";
}

async function savePortal(
  targetId: number,
  enabled: boolean,
  slugRaw: unknown,
  pinRaw: unknown,
  waRaw: unknown
) {
  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, role: true, nama: true, portalPinHash: true },
  });
  if (!target || target.role !== "Admin") {
    return NextResponse.json(
      { error: "Portal hanya untuk akun Admin." },
      { status: 400 }
    );
  }
  const slug = normalizePortalSlug(slugRaw);
  const slugErr = portalSlugError(slug, enabled);
  if (slugErr) {
    return NextResponse.json({ error: slugErr }, { status: 400 });
  }
  if (slug) {
    const [takenUser, takenBersama] = await Promise.all([
      prisma.user.findFirst({
        where: { portalSlug: slug, NOT: { id: targetId } },
        select: { id: true },
      }),
      prisma.portalBersama.findFirst({
        where: { slug },
        select: { id: true },
      }),
    ]);
    if (takenUser || takenBersama) {
      return NextResponse.json(
        { error: "Link sudah dipakai." },
        { status: 400 }
      );
    }
  }
  const pin = normalizePortalPin(pinRaw);
  const pinErr = portalPinError(pin);
  if (pinErr) {
    return NextResponse.json({ error: pinErr }, { status: 400 });
  }
  if (enabled && !target.portalPinHash && !pin) {
    return NextResponse.json(
      { error: "Isi PIN portal sebelum dihidupkan." },
      { status: 400 }
    );
  }
  const wa = normalizePortalWaCs(waRaw);
  const waErr = portalWaCsError(wa);
  if (waErr) {
    return NextResponse.json({ error: waErr }, { status: 400 });
  }
  const pinHash = pin ? await hash(pin, ARGON2_OPTS) : undefined;
  const saved = await prisma.user.update({
    where: { id: targetId },
    data: {
      portalPelangganEnabled: enabled,
      portalSlug: slug,
      portalWaCs: wa,
      ...(pinHash ? { portalPinHash: pinHash } : {}),
    },
    select: {
      id: true,
      nama: true,
      portalPelangganEnabled: true,
      portalSlug: true,
      portalPinHash: true,
      portalWaCs: true,
    },
  });
  return NextResponse.json({
    data: {
      id: saved.id,
      nama: saved.nama,
      enabled: saved.portalPelangganEnabled,
      slug: saved.portalSlug,
      hasPin: Boolean(saved.portalPinHash),
      wa: saved.portalWaCs,
    },
  });
}

export async function GET(request: NextRequest) {
  const { user, session } = await validateRequest();
  if (!session || !user) {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
  }
  if (!canEditPortal(user.role)) {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });
  }

  const slugQuery = request.nextUrl.searchParams.get("slug");
  if (slugQuery != null) {
    const exceptId =
      user.role === "Superadmin"
        ? Number(request.nextUrl.searchParams.get("userId"))
        : getOwnedResourcesUserId(user);
    const slug = normalizePortalSlug(slugQuery);
    const slugErr = portalSlugError(slug, false);
    if (!slug || slugErr) {
      return NextResponse.json({
        available: false,
        message: slugErr ?? "Link tidak valid.",
      });
    }
    const [takenUser, takenBersama] = await Promise.all([
      prisma.user.findFirst({
        where: {
          portalSlug: slug,
          ...(Number.isInteger(exceptId) && exceptId > 0
            ? { NOT: { id: exceptId } }
            : {}),
        },
        select: { id: true },
      }),
      prisma.portalBersama.findFirst({
        where: { slug },
        select: { id: true },
      }),
    ]);
    const taken = Boolean(takenUser || takenBersama);
    return NextResponse.json({
      available: !taken,
      message: taken ? "Sudah dipakai." : "Bisa dipakai.",
    });
  }

  if (user.role === "Superadmin") {
    const mitra = await prisma.user.findMany({
      where: { role: "Admin", parentId: null },
      select: {
        id: true,
        nama: true,
        portalPelangganEnabled: true,
        portalSlug: true,
        portalPinHash: true,
        portalWaCs: true,
      },
      orderBy: [{ nama: "asc" }, { id: "asc" }],
    });
    const bersama = await prisma.portalBersama.findMany({
      select: {
        id: true,
        nama: true,
        slug: true,
        enabled: true,
        kontakMode: true,
        pinHash: true,
        waCs: true,
        anggota: { select: { userId: true } },
      },
      orderBy: [{ nama: "asc" }, { id: "asc" }],
    });
    return NextResponse.json({
      data: {
        mitra: mitra.map((row) => ({
          id: row.id,
          nama: row.nama,
          enabled: row.portalPelangganEnabled,
          slug: row.portalSlug,
          hasPin: Boolean(row.portalPinHash),
          wa: row.portalWaCs,
        })),
        bersama: bersama.map((row) => ({
          id: row.id,
          nama: row.nama,
          slug: row.slug,
          enabled: row.enabled,
          kontakMode: row.kontakMode === "bersama" ? "bersama" : "beda",
          hasPin: Boolean(row.pinHash),
          wa: row.waCs,
          mitraIds: row.anggota.map((item) => item.userId),
        })),
      },
    });
  }

  const self = await prisma.user.findUnique({
    where: { id: getOwnedResourcesUserId(user) },
    select: {
      id: true,
      nama: true,
      portalPelangganEnabled: true,
      portalSlug: true,
      portalPinHash: true,
      portalWaCs: true,
    },
  });
  if (!self) {
    return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
  }
  const lockedBersama = await lockedBersamaForMitra(self.id);
  return NextResponse.json({
    data: {
      self: {
        id: self.id,
        nama: self.nama,
        enabled: self.portalPelangganEnabled,
        slug: self.portalSlug,
        hasPin: Boolean(self.portalPinHash),
        wa: self.portalWaCs,
      },
      lockedBersama,
    },
  });
}

export async function PUT(request: NextRequest) {
  const { user, session } = await validateRequest();
  if (!session || !user) {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
  }
  if (!canEditPortal(user.role)) {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });
  }

  const body = (await request.json()) as {
    enabled?: boolean;
    slug?: string | null;
    pin?: string | null;
    wa?: string | null;
    userId?: number;
  };
  const ownedId =
    user.role === "Admin" ? getOwnedResourcesUserId(user) : user.id;
  const targetId =
    user.role === "Superadmin" ? Number(body.userId) : ownedId;
  if (!Number.isInteger(targetId) || targetId <= 0) {
    return NextResponse.json({ error: "Pilih mitra." }, { status: 400 });
  }
  if (user.role === "Admin" && targetId !== ownedId) {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });
  }
  if (user.role === "Admin") {
    const locked = await lockedBersamaForMitra(targetId);
    if (locked.length > 0) {
      const kontakLocked = locked.every((row) => row.kontakMode === "bersama");
      if (kontakLocked) {
        return NextResponse.json(
          { error: "PIN dan WhatsApp mengikuti pengaturan Superadmin." },
          { status: 403 }
        );
      }
      const existing = await prisma.user.findUnique({
        where: { id: targetId },
        select: { portalPelangganEnabled: true, portalSlug: true },
      });
      return savePortal(
        targetId,
        existing?.portalPelangganEnabled === true,
        existing?.portalSlug,
        body.pin,
        body.wa
      );
    }
  }
  return savePortal(targetId, body.enabled === true, body.slug, body.pin, body.wa);
}
