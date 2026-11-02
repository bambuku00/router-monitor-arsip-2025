import prisma from "@/lib/prisma";

export const PPP_ROUTER_LOCK_TTL_MS = 10 * 60 * 1000;
export const PPP_BACKGROUND_GLOBAL_LOCK_TTL_MS = 25 * 60 * 1000;

export function pppRouterLockName(routerId: number): string {
  return `ppp-sync:router:${routerId}`;
}

export const PPP_BACKGROUND_LOCK_NAME = "ppp-background-sync";

export async function acquireNamedJobLock(
  name: string,
  owner: string,
  ttlMs: number
): Promise<boolean> {
  const now = new Date();
  const lockedUntil = new Date(now.getTime() + ttlMs);

  const existing = await prisma.jobLock.findUnique({ where: { name } });
  if (existing && existing.lockedUntil > now) {
    return false;
  }

  await prisma.jobLock.upsert({
    where: { name },
    create: { name, lockedAt: now, lockedUntil, owner },
    update: { lockedAt: now, lockedUntil, owner },
  });

  return true;
}

export async function releaseNamedJobLock(
  name: string,
  owner: string
): Promise<void> {
  const existing = await prisma.jobLock.findUnique({ where: { name } });
  if (existing?.owner === owner) {
    await prisma.jobLock.delete({ where: { name } }).catch(() => {});
  }
}

export async function acquireRouterPppSyncLock(
  routerId: number,
  owner: string
): Promise<boolean> {
  return acquireNamedJobLock(
    pppRouterLockName(routerId),
    owner,
    PPP_ROUTER_LOCK_TTL_MS
  );
}

export async function releaseRouterPppSyncLock(
  routerId: number,
  owner: string
): Promise<void> {
  return releaseNamedJobLock(pppRouterLockName(routerId), owner);
}
