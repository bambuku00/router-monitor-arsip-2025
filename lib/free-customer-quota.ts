import { logActivityEvent } from "@/lib/activity-audit-log";
import { resolveIsFreeCustomerForPaket } from "@/lib/pelanggan-billing-category";
import prisma from "@/lib/prisma";
import type { RoleName } from "@prisma/client";

export const FREE_CUSTOMER_QUOTA_EXCEEDED_MESSAGE =
  "Kuota pelanggan gratis untuk pemilik router ini telah habis. Tambahkan kuota melalui pengaturan User apabila diperlukan.";

export class FreeCustomerQuotaExceededError extends Error {
  constructor(message = FREE_CUSTOMER_QUOTA_EXCEEDED_MESSAGE) {
    super(message);
    this.name = "FreeCustomerQuotaExceededError";
  }
}

export type FreeCustomerQuotaActor = {
  id: number;
  role: RoleName;
  user?: string;
};

export type FreeCustomerQuotaSummary = {
  userId: number;
  nama: string;
  user: string;
  role: RoleName;
  freeCustomerLimit: number | null;
  used: number;
  remaining: number | null;
  overLimit: boolean;
};

export async function getOwnerUserIdForRouter(
  routerId: number
): Promise<number | null> {
  const router = await prisma.router.findUnique({
    where: { id: routerId },
    select: { userId: true },
  });
  return router?.userId ?? null;
}

export async function countActiveFreeCustomersForOwner(
  ownerUserId: number,
  excludePelangganId?: number
): Promise<number> {
  return prisma.pelanggan.count({
    where: {
      stop: false,
      ppp_secretId: { not: null },
      isFreeCustomer: true,
      router: { userId: ownerUserId },
      ...(excludePelangganId != null ? { id: { not: excludePelangganId } } : {}),
    },
  });
}

export async function getFreeCustomerLimitForOwner(
  ownerUserId: number
): Promise<number | null> {
  const row = await prisma.user.findUnique({
    where: { id: ownerUserId },
    select: { freeCustomerLimit: true },
  });
  return row?.freeCustomerLimit ?? null;
}

export function computeFreeCustomerQuotaRemaining(
  limit: number | null,
  used: number
): { remaining: number | null; overLimit: boolean } {
  if (limit === null) {
    return { remaining: null, overLimit: false };
  }
  const remaining = limit - used;
  return { remaining, overLimit: remaining < 0 };
}

export async function buildFreeCustomerQuotaSummary(
  ownerUserId: number
): Promise<FreeCustomerQuotaSummary | null> {
  const user = await prisma.user.findUnique({
    where: { id: ownerUserId },
    select: {
      id: true,
      nama: true,
      user: true,
      role: true,
      freeCustomerLimit: true,
    },
  });
  if (!user) return null;

  const used = await countActiveFreeCustomersForOwner(ownerUserId);
  const { remaining, overLimit } = computeFreeCustomerQuotaRemaining(
    user.freeCustomerLimit,
    used
  );

  return {
    userId: user.id,
    nama: user.nama,
    user: user.user,
    role: user.role,
    freeCustomerLimit: user.freeCustomerLimit,
    used,
    remaining,
    overLimit,
  };
}

export type FreeCustomerQuotaCheckResult =
  | { ok: true; unlimited: true }
  | {
      ok: true;
      unlimited: false;
      limit: number;
      used: number;
      remaining: number;
    }
  | { ok: false; limit: number; used: number; message: string };

export async function checkFreeCustomerQuota(params: {
  ownerUserId: number;
  excludePelangganId?: number;
  slotsNeeded?: number;
}): Promise<FreeCustomerQuotaCheckResult> {
  const limit = await getFreeCustomerLimitForOwner(params.ownerUserId);
  if (limit === null) {
    return { ok: true, unlimited: true };
  }

  const used = await countActiveFreeCustomersForOwner(
    params.ownerUserId,
    params.excludePelangganId
  );
  const slotsNeeded = params.slotsNeeded ?? 1;

  if (used + slotsNeeded > limit) {
    return {
      ok: false,
      limit,
      used,
      message: FREE_CUSTOMER_QUOTA_EXCEEDED_MESSAGE,
    };
  }

  return {
    ok: true,
    unlimited: false,
    limit,
    used,
    remaining: limit - used - slotsNeeded,
  };
}

export async function assertFreeCustomerQuotaAllowed(params: {
  ownerUserId: number;
  paketHarga: number;
  excludePelangganId?: number;
}): Promise<void> {
  if (!resolveIsFreeCustomerForPaket(params.paketHarga)) return;

  const check = await checkFreeCustomerQuota({
    ownerUserId: params.ownerUserId,
    excludePelangganId: params.excludePelangganId,
    slotsNeeded: 1,
  });

  if (check.ok) return;

  throw new FreeCustomerQuotaExceededError(check.message);
}

export async function logFreeCustomerLimitChanged(params: {
  actor: FreeCustomerQuotaActor;
  targetUserId: number;
  targetUsername: string;
  oldLimit: number | null;
  newLimit: number | null;
}): Promise<void> {
  logActivityEvent({
    action: "free_customer_limit_changed",
    userId: params.actor.id,
    username: params.actor.user,
    reason: `Kuota pelanggan gratis ${params.targetUsername}: ${formatLimitLabel(params.oldLimit)} → ${formatLimitLabel(params.newLimit)}`,
    meta: {
      targetUserId: params.targetUserId,
      targetUsername: params.targetUsername,
      oldLimit: params.oldLimit,
      newLimit: params.newLimit,
    },
  });
}

export function formatLimitLabel(limit: number | null): string {
  return limit === null ? "Unlimited" : String(limit);
}

export function freeCustomerQuotaErrorResponse(err: unknown) {
  if (err instanceof FreeCustomerQuotaExceededError) {
    return { message: err.message, status: 403 as const };
  }
  return null;
}
