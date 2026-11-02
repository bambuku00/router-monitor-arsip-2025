import { validateRequest } from "@/lib/auth";
import { getOwnedResourcesUserId } from "@/lib/rbac";
import { staffMenuApiForbidden } from "@/lib/staff-menu-api";
import { resolveIsolirExecutedBy } from "@/lib/manual-isolir-log";
import prisma from "@/lib/prisma";
import { RoleName, type AutoIsolirLogStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const AUTO_ISOLIR_ROLES: RoleName[] = [
  RoleName.Superadmin,
  RoleName.Admin,
  RoleName.Keuangan,
];

export async function GET(request: NextRequest) {
  const { user, session } = await validateRequest();
  if (!session || !user) return new Response(null, { status: 401 });
  const denied = staffMenuApiForbidden(user, request.nextUrl.pathname);
  if (denied) return denied;
  if (!AUTO_ISOLIR_ROLES.includes(user.role)) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const qUserId = sp.get("userId");
  const mitraUserId =
    user.role === RoleName.Superadmin && qUserId
      ? parseInt(qUserId, 10)
      : getOwnedResourcesUserId({
          id: user.id,
          role: user.role,
          parentId: user.parentId ?? undefined,
        });

  const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") || "50", 10) || 50));
  const statusRaw = sp.get("status")?.toLowerCase();
  const statusFilter =
    statusRaw === "success" || statusRaw === "failed" || statusRaw === "skipped"
      ? (statusRaw as AutoIsolirLogStatus)
      : undefined;
  const dateFrom = sp.get("from");
  const dateTo = sp.get("to");

  const where = {
    userId: mitraUserId,
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(dateFrom || dateTo
      ? {
          created: {
            ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00.000Z`) } : {}),
            ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59.999Z`) } : {}),
          },
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.autoIsolirLog.count({ where }),
    prisma.autoIsolirLog.findMany({
      where,
      orderBy: { created: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        pelanggan: { select: { id: true, nama: true } },
        router: { select: { id: true, nama: true } },
        pembayaran: { select: { id: true, jatuh_tempo: true, total: true } },
      },
    }),
  ]);

  return NextResponse.json({
    data: await resolveIsolirExecutedBy(rows),
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  });
}
