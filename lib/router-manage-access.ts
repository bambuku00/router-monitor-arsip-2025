import type { RoleName } from "@prisma/client";
import type { User } from "lucia";
import { NextResponse } from "next/server";

import { getRouterForUser } from "@/lib/authz";
import { canAccessUser } from "@/lib/rbac";

type RouterActor = {
  id: number;
  role: RoleName;
  parentId?: number | null;
};
type RouterRecord = { userId: number | null };

const MANAGE_DENIED =
  "Hanya Admin pemilik scope atau Superadmin yang dapat mengubah konfigurasi router.";

/** Superadmin / Admin boleh mutasi konfigurasi router; Teknisi & Keuangan tidak. */
export function canManageRouterConfig(actor: RouterActor): boolean {
  return actor.role === "Superadmin" || actor.role === "Admin";
}

/** Apakah actor boleh melihat router dalam scope (setelah record/routerId diverifikasi). */
export function canViewRouter(
  actor: RouterActor,
  router: RouterRecord
): boolean {
  if (actor.role === "Superadmin") return true;
  if (router.userId == null) return false;
  return canAccessUser(
    { id: actor.id, role: actor.role, parentId: actor.parentId ?? undefined },
    router.userId
  );
}

/** Apakah actor boleh create/update/delete router ini. */
export function canManageRouter(
  actor: RouterActor,
  router: RouterRecord
): boolean {
  if (!canManageRouterConfig(actor)) return false;
  if (actor.role === "Superadmin") return true;
  if (router.userId == null) return false;
  return canAccessUser(
    { id: actor.id, role: actor.role, parentId: actor.parentId ?? undefined },
    router.userId
  );
}

export function routerManageApiForbidden(user: User): NextResponse | null {
  if (canManageRouterConfig(user)) return null;
  return NextResponse.json({ error: MANAGE_DENIED }, { status: 403 });
}

export async function requireRouterManageById(
  user: User,
  routerId: number
): Promise<
  | { ok: true; router: NonNullable<Awaited<ReturnType<typeof getRouterForUser>>> }
  | { ok: false; response: NextResponse }
> {
  const router = await getRouterForUser(routerId, user);
  if (!router) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Router tidak ditemukan atau akses ditolak" },
        { status: 403 }
      ),
    };
  }
  if (!canManageRouter(user, router)) {
    return {
      ok: false,
      response: NextResponse.json({ error: MANAGE_DENIED }, { status: 403 }),
    };
  }
  return { ok: true, router };
}

export async function requireRouterViewById(
  user: User,
  routerId: number
): Promise<
  | { ok: true; router: NonNullable<Awaited<ReturnType<typeof getRouterForUser>>> }
  | { ok: false; response: NextResponse }
> {
  const router = await getRouterForUser(routerId, user);
  if (!router) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Router tidak ditemukan atau akses ditolak" },
        { status: 403 }
      ),
    };
  }
  if (!canViewRouter(user, router)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Router tidak ditemukan atau akses ditolak" },
        { status: 403 }
      ),
    };
  }
  return { ok: true, router };
}

/** Prisma select untuk list/detail router — tanpa password; staff read-only tanpa credential fields. */
export function routerListPrismaSelect(role: RoleName) {
  const readOnly = {
    id: true,
    nama: true,
    host: true,
    port: true,
    lat: true,
    lng: true,
    os_version: true,
    created: true,
    updated: true,
  } as const;

  if (canManageRouterConfig({ role, id: 0, parentId: null })) {
    return {
      ...readOnly,
      user: true,
      userId: true,
    } as const;
  }

  return readOnly;
}

export { MANAGE_DENIED };
