import { validateRequest } from "@/lib/auth";
import { getOwnedResourcesUserId } from "@/lib/rbac";
import { getOrCreateAutoIsolirSettings } from "@/lib/auto-isolir/overdue";
import { staffMenuApiForbidden } from "@/lib/staff-menu-api";
import prisma from "@/lib/prisma";
import { RoleName } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const AUTO_ISOLIR_ROLES: RoleName[] = [
  RoleName.Superadmin,
  RoleName.Admin,
  RoleName.Keuangan,
];

function canAccessAutoIsolir(role: RoleName) {
  return AUTO_ISOLIR_ROLES.includes(role);
}

function resolveMitraUserId(
  user: { id: number; role: RoleName; parentId?: number | null },
  queryUserId?: number
) {
  if (user.role === RoleName.Superadmin && queryUserId) return queryUserId;
  return getOwnedResourcesUserId({
    id: user.id,
    role: user.role,
    parentId: user.parentId ?? undefined,
  });
}

const SettingsSchema = z.object({
  userId: z.number().int().optional(),
  enabled: z.boolean().optional(),
  toleranceDays: z.number().int().min(0).max(30).optional(),
  executeTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Format jam HH:mm")
    .optional(),
  isolirProfileName: z.string().min(1).max(64).optional(),
  onlyActiveCustomers: z.boolean().optional(),
  notifyBefore: z.boolean().optional(),
  notifyAfter: z.boolean().optional(),
  autoRestoreOnPayment: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  const { user, session } = await validateRequest();
  if (!session || !user) return new Response(null, { status: 401 });
  const denied = staffMenuApiForbidden(user, request.nextUrl.pathname);
  if (denied) return denied;
  if (!canAccessAutoIsolir(user.role)) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const qUserId = request.nextUrl.searchParams.get("userId");
  const mitraUserId = resolveMitraUserId(
    user,
    qUserId ? parseInt(qUserId, 10) : undefined
  );

  const settings = await getOrCreateAutoIsolirSettings(mitraUserId);
  return NextResponse.json({ data: settings });
}

export async function PATCH(request: NextRequest) {
  const { user, session } = await validateRequest();
  if (!session || !user) return new Response(null, { status: 401 });
  const denied = staffMenuApiForbidden(user, request.nextUrl.pathname);
  if (denied) return denied;
  if (!canAccessAutoIsolir(user.role)) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const parsed = SettingsSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const mitraUserId = resolveMitraUserId(user, parsed.data.userId);

  const { userId: _omit, ...fields } = parsed.data;
  const settings = await prisma.autoIsolirSettings.upsert({
    where: { userId: mitraUserId },
    create: { userId: mitraUserId, ...fields },
    update: fields,
  });

  return NextResponse.json({ data: settings, message: "Pengaturan disimpan" });
}
