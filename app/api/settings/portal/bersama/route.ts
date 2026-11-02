import { validateRequest } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { normalizePortalPin, normalizePortalSlug, normalizePortalWaCs, portalPinError, portalSlugError, portalWaCsError } from "@/lib/portal-slug";
import { hash } from "argon2";
import { NextRequest, NextResponse } from "next/server";

const ARGON2_OPTS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

function cleanMitraIds(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return [
    ...new Set(
      raw
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
    ),
  ];
}

async function slugAvailable(slug: string, exceptPortalId?: number) {
  const [user, group] = await Promise.all([
    prisma.user.findFirst({
      where: { portalSlug: slug },
      select: { id: true },
    }),
    prisma.portalBersama.findFirst({
      where: {
        slug,
        ...(exceptPortalId ? { NOT: { id: exceptPortalId } } : {}),
      },
      select: { id: true },
    }),
  ]);
  return !user && !group;
}

export async function PUT(request: NextRequest) {
  const { user, session } = await validateRequest();
  if (!session || !user) {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
  }
  if (user.role !== "Superadmin") {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });
  }

  const body = (await request.json()) as {
    id?: number;
    nama?: string;
    slug?: string;
    enabled?: boolean;
    mitraIds?: number[];
    kontakMode?: string;
    pin?: string | null;
    wa?: string | null;
  };
  const nama = String(body.nama ?? "").trim().slice(0, 80);
  if (nama.length < 2) {
    return NextResponse.json({ error: "Isi nama portal bersama." }, { status: 400 });
  }
  const slug = normalizePortalSlug(body.slug);
  const slugErr = portalSlugError(slug, true);
  if (!slug || slugErr) {
    return NextResponse.json({ error: slugErr ?? "Link tidak valid." }, { status: 400 });
  }
  const mitraIds = cleanMitraIds(body.mitraIds);
  if (mitraIds.length < 2) {
    return NextResponse.json(
      { error: "Pilih minimal dua mitra." },
      { status: 400 }
    );
  }
  const mitra = await prisma.user.findMany({
    where: { id: { in: mitraIds }, role: "Admin", parentId: null, disabled: false },
    select: { id: true },
  });
  if (mitra.length !== mitraIds.length) {
    return NextResponse.json(
      { error: "Semua pilihan harus akun mitra yang aktif." },
      { status: 400 }
    );
  }

  const kontakMode = body.kontakMode === "bersama" ? "bersama" : "beda";
  const pin = kontakMode === "bersama" ? normalizePortalPin(body.pin) : null;
  const pinErr = portalPinError(pin);
  if (pinErr) {
    return NextResponse.json({ error: pinErr }, { status: 400 });
  }
  const wa = kontakMode === "bersama" ? normalizePortalWaCs(body.wa) : null;
  const waErr = portalWaCsError(wa);
  if (waErr) {
    return NextResponse.json({ error: waErr }, { status: 400 });
  }

  const portalId = Number(body.id);
  const editing = Number.isInteger(portalId) && portalId > 0;
  const existing = editing
    ? await prisma.portalBersama.findUnique({
        where: { id: portalId },
        select: { pinHash: true },
      })
    : null;
  if (editing && !existing) {
    return NextResponse.json({ error: "Portal tidak ditemukan." }, { status: 400 });
  }
  if (kontakMode === "bersama" && !pin && !existing?.pinHash) {
    return NextResponse.json(
      { error: "Isi PIN bersama sebelum mode ini dipakai." },
      { status: 400 }
    );
  }
  if (!(await slugAvailable(slug, editing ? portalId : undefined))) {
    return NextResponse.json({ error: "Link sudah dipakai." }, { status: 400 });
  }
  const pinHash = pin ? await hash(pin, ARGON2_OPTS) : undefined;

  const data = {
    nama,
    slug,
    enabled: body.enabled !== false,
    kontakMode,
    ...(kontakMode === "bersama" ? { waCs: wa } : {}),
    ...(pinHash ? { pinHash } : {}),
    anggota: {
      deleteMany: {},
      create: mitraIds.map((userId) => ({ userId })),
    },
  };
  const select = {
    id: true,
    nama: true,
    slug: true,
    enabled: true,
    kontakMode: true,
    pinHash: true,
    waCs: true,
    anggota: { select: { userId: true } },
  } as const;

  const saved = editing
    ? await prisma.portalBersama.update({
        where: { id: portalId },
        data,
        select,
      })
    : await prisma.portalBersama.create({
        data: {
          nama,
          slug,
          enabled: body.enabled !== false,
          kontakMode,
          waCs: kontakMode === "bersama" ? wa : null,
          ...(pinHash ? { pinHash } : {}),
          anggota: { create: mitraIds.map((userId) => ({ userId })) },
        },
        select,
      });

  return NextResponse.json({
    data: {
      id: saved.id,
      nama: saved.nama,
      slug: saved.slug,
      enabled: saved.enabled,
      kontakMode: saved.kontakMode === "bersama" ? "bersama" : "beda",
      hasPin: Boolean(saved.pinHash),
      wa: saved.waCs,
      mitraIds: saved.anggota.map((row) => row.userId),
    },
  });
}

export async function DELETE(request: NextRequest) {
  const { user, session } = await validateRequest();
  if (!session || !user) {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
  }
  if (user.role !== "Superadmin") {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });
  }
  const id = Number(request.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Portal tidak ditemukan." }, { status: 400 });
  }
  await prisma.portalBersama.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}
