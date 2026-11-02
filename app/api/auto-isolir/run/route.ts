import { validateRequest } from "@/lib/auth";
import { getOwnedResourcesUserId } from "@/lib/rbac";
import { dryRunAutoIsolation, runAutoIsolation } from "@/lib/auto-isolir/run";
import {
  getStaffPelangganScopeIds,
  isStaffPelangganScopedRole,
} from "@/lib/staff-pelanggan-scope";
import { staffMenuApiForbidden } from "@/lib/staff-menu-api";
import { logger } from "@/lib/logger";
import { RoleName } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const AUTO_ISOLIR_ROLES: RoleName[] = [
  RoleName.Superadmin,
  RoleName.Admin,
  RoleName.Keuangan,
];

const RunSchema = z.object({
  userId: z.number().int().optional(),
  dryRun: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const { user, session } = await validateRequest();
  if (!session || !user) return new Response(null, { status: 401 });
  const denied = staffMenuApiForbidden(user, request.nextUrl.pathname);
  if (denied) return denied;
  if (!AUTO_ISOLIR_ROLES.includes(user.role)) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const parsed = RunSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const mitraUserId =
    user.role === RoleName.Superadmin && parsed.data.userId
      ? parsed.data.userId
      : getOwnedResourcesUserId({
          id: user.id,
          role: user.role,
          parentId: user.parentId ?? undefined,
        });
  const dryRun = parsed.data.dryRun ?? false;

  // H9: restricted Keuangan may only isolate assigned pelanggan.
  let pelangganIdAllowList: number[] | undefined;
  if (isStaffPelangganScopedRole(user.role)) {
    const scopeIds = await getStaffPelangganScopeIds(user.id);
    if (scopeIds !== null) {
      pelangganIdAllowList = scopeIds;
    }
  }

  try {
    const result = dryRun
      ? await dryRunAutoIsolation(mitraUserId, pelangganIdAllowList)
      : await runAutoIsolation({
          userId: mitraUserId,
          dryRun: false,
          force: true,
          executedBy: `user:${user.id}`,
          pelangganIdAllowList,
        });

    if (result.skippedLock) {
      return NextResponse.json(
        { error: "Auto isolir sedang berjalan di server lain", ...result },
        { status: 409 }
      );
    }

    return NextResponse.json({ data: result });
  } catch (err) {
    logger.error({ msg: "Manual auto isolir run failed", error: err });
    return NextResponse.json(
      { error: "Gagal menjalankan auto isolir" },
      { status: 500 }
    );
  }
}
