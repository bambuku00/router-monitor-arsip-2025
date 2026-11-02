import { listActivityLogs, isActivityFilter } from "@/lib/activity-log-query";
import { validateRequest } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getOwnedResourcesUserId } from "@/lib/rbac";
import { RoleName } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ROLES: RoleName[] = [RoleName.Superadmin, RoleName.Admin];

export async function GET(request: NextRequest) {
  const { user, session } = await validateRequest();
  if (!session || !user) return new Response(null, { status: 401 });
  if (!ROLES.includes(user.role)) {
    return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(sp.get("limit") || "30", 10) || 30));
  const rawAction = sp.get("action")?.trim() ?? "";
  const action = isActivityFilter(rawAction) ? rawAction : "";
  const dateFrom = sp.get("from")?.trim() ?? "";
  const dateTo = sp.get("to")?.trim() ?? "";

  const scope =
    user.role === RoleName.Superadmin
      ? { mitraId: null, userIds: [], usernames: [] }
      : await mitraScope(user);

  const result = await listActivityLogs({
    scope,
    page,
    limit,
    action,
    from: dateFrom,
    to: dateTo,
  });

  return NextResponse.json({
    data: result.data,
    pagination: {
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit) || 1,
    },
  });
}

async function mitraScope(user: {
  id: number;
  role: RoleName;
  parentId?: number | null;
}) {
  const mitraId = getOwnedResourcesUserId({
    id: user.id,
    role: user.role,
    parentId: user.parentId ?? undefined,
  });
  const people = await prisma.user.findMany({
    where: { OR: [{ id: mitraId }, { parentId: mitraId }] },
    select: { id: true, user: true },
  });
  return {
    mitraId,
    userIds: people.map((person) => person.id),
    usernames: people.map((person) => person.user),
  };
}
