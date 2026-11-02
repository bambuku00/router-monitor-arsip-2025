import { validateRequest } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { encryptTripaySecret } from "@/lib/tripay";
import { getOwnedResourcesUserId } from "@/lib/rbac";
import { NextRequest, NextResponse } from "next/server";

function canEdit(role: string) {
  return role === "Admin" || role === "Superadmin";
}

function cleanCode(raw: unknown): string {
  return String(raw ?? "")
    .trim()
    .slice(0, 32);
}

function cleanSecret(raw: unknown): string {
  return String(raw ?? "").trim().slice(0, 200);
}

function view(row: {
  userId: number;
  nama: string;
  enabled: boolean;
  sandbox: boolean;
  merchantCode: string;
  apiKey: string;
  privateKey: string;
}) {
  return {
    id: row.userId,
    nama: row.nama,
    enabled: row.enabled,
    sandbox: row.sandbox,
    merchantCode: row.merchantCode,
    hasApiKey: Boolean(row.apiKey),
    hasPrivateKey: Boolean(row.privateKey),
  };
}

export async function GET() {
  const { user, session } = await validateRequest();
  if (!session || !user) {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
  }
  if (!canEdit(user.role)) {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });
  }

  if (user.role === "Superadmin") {
    const mitra = await prisma.user.findMany({
      where: { role: "Admin", parentId: null },
      select: {
        id: true,
        nama: true,
        tripayGateway: true,
      },
      orderBy: [{ nama: "asc" }, { id: "asc" }],
    });
    return NextResponse.json({
      data: {
        mitra: mitra.map((row) =>
          view({
            userId: row.id,
            nama: row.nama,
            enabled: row.tripayGateway?.enabled === true,
            sandbox: row.tripayGateway?.sandbox !== false,
            merchantCode: row.tripayGateway?.merchantCode ?? "",
            apiKey: row.tripayGateway?.apiKey ?? "",
            privateKey: row.tripayGateway?.privateKey ?? "",
          })
        ),
      },
    });
  }

  const self = await prisma.user.findUnique({
    where: { id: getOwnedResourcesUserId(user) },
    select: { id: true, nama: true, tripayGateway: true },
  });
  if (!self) {
    return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
  }
  return NextResponse.json({
    data: {
      self: view({
        userId: self.id,
        nama: self.nama,
        enabled: self.tripayGateway?.enabled === true,
        sandbox: self.tripayGateway?.sandbox !== false,
        merchantCode: self.tripayGateway?.merchantCode ?? "",
        apiKey: self.tripayGateway?.apiKey ?? "",
        privateKey: self.tripayGateway?.privateKey ?? "",
      }),
    },
  });
}

export async function PUT(request: NextRequest) {
  const { user, session } = await validateRequest();
  if (!session || !user) {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 401 });
  }
  if (!canEdit(user.role)) {
    return NextResponse.json({ error: "Tidak diizinkan" }, { status: 403 });
  }

  const body = (await request.json()) as {
    userId?: number;
    enabled?: boolean;
    sandbox?: boolean;
    merchantCode?: string;
    apiKey?: string;
    privateKey?: string;
  };
  const targetId =
    user.role === "Superadmin"
      ? Number(body.userId)
      : getOwnedResourcesUserId(user);
  if (!Number.isInteger(targetId) || targetId <= 0) {
    return NextResponse.json({ error: "Pilih mitra." }, { status: 400 });
  }
  const target = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, nama: true, role: true, parentId: true, tripayGateway: true },
  });
  if (!target || target.role !== "Admin" || target.parentId != null) {
    return NextResponse.json({ error: "Gateway hanya untuk akun mitra." }, { status: 400 });
  }

  const enabled = body.enabled === true;
  const sandbox = body.sandbox !== false;
  const merchantCode = cleanCode(body.merchantCode);
  const apiKey = cleanSecret(body.apiKey);
  const privateKey = cleanSecret(body.privateKey);
  const hasApiKey = Boolean(apiKey || target.tripayGateway?.apiKey);
  const hasPrivateKey = Boolean(privateKey || target.tripayGateway?.privateKey);
  if (enabled && (!merchantCode || !hasApiKey || !hasPrivateKey)) {
    return NextResponse.json(
      { error: "Isi kode merchant, API key, dan private key sebelum gateway dihidupkan." },
      { status: 400 }
    );
  }

  const saved = await prisma.tripayGateway.upsert({
    where: { userId: targetId },
    create: {
      userId: targetId,
      enabled,
      sandbox,
      merchantCode,
      apiKey: apiKey ? encryptTripaySecret(apiKey) : "",
      privateKey: privateKey ? encryptTripaySecret(privateKey) : "",
    },
    update: {
      enabled,
      sandbox,
      merchantCode,
      ...(apiKey ? { apiKey: encryptTripaySecret(apiKey) } : {}),
      ...(privateKey ? { privateKey: encryptTripaySecret(privateKey) } : {}),
    },
  });

  return NextResponse.json({
    data: view({
      userId: target.id,
      nama: target.nama,
      enabled: saved.enabled,
      sandbox: saved.sandbox,
      merchantCode: saved.merchantCode,
      apiKey: saved.apiKey,
      privateKey: saved.privateKey,
    }),
  });
}
