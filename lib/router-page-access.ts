import type { User } from "lucia";
import { notFound, redirect } from "next/navigation";

import { getRouterForUser } from "@/lib/authz";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";

export type RouterIdAccessResult =
  | { status: "ok"; routerId: number }
  | { status: "not_found" }
  | { status: "forbidden" };

/**
 * Memisahkan router tidak ada (404) vs ada tetapi di luar scope user (forbidden).
 * Tidak mengembalikan data router — hanya status.
 */
export async function resolveRouterIdAccess(
  user: User,
  rawId: string
): Promise<RouterIdAccessResult> {
  const id = parseInt(rawId, 10);
  if (!rawId?.trim() || Number.isNaN(id)) {
    return { status: "not_found" };
  }

  const exists = await prisma.router.findFirst({
    where: { id, deleted: false },
    select: { id: true },
  });
  if (!exists) {
    return { status: "not_found" };
  }

  const authorized = await getRouterForUser(id, user);
  if (!authorized) {
    logger.info({
      msg: "router_page_access_denied",
      routerId: id,
      userId: user.id,
      role: user.role,
    });
    return { status: "forbidden" };
  }

  return { status: "ok", routerId: id };
}

/** Terapkan hasil resolve: notFound / forbidden / kembalikan id. */
export function assertRouterIdAccess(result: RouterIdAccessResult): number {
  if (result.status === "not_found") notFound();
  if (result.status === "forbidden") redirect("/forbidden");
  return result.routerId;
}
