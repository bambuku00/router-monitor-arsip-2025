import {
  computeFreeCustomerQuotaRemaining,
  countActiveFreeCustomersForOwner,
  getFreeCustomerLimitForOwner,
} from "@/lib/free-customer-quota";

export type FreeCustomerQuotaDisplayStatus =
  | "unlimited"
  | "ok"
  | "warning"
  | "full"
  | "over";

export type PppRouterFreeCustomerStats = {
  used: number;
  limit: number | null;
  remaining: number | null;
  overLimit: boolean;
  status: FreeCustomerQuotaDisplayStatus;
};

export type PppFreeCustomerQuotaStats = PppRouterFreeCustomerStats & {
  ownerUserId: number;
};

export function getFreeCustomerQuotaDisplayStatus(params: {
  used: number;
  limit: number | null;
}): FreeCustomerQuotaDisplayStatus {
  const { used, limit } = params;
  if (limit === null) return "unlimited";
  if (used > limit) return "over";
  if (used === limit) return "full";
  const remaining = limit - used;
  if (remaining <= 1 || used / limit >= 0.8) return "warning";
  return "ok";
}

export function formatFreeCustomerQuotaValue(stats: PppRouterFreeCustomerStats): {
  primary: string;
  secondary?: string;
} {
  if (stats.limit === null) {
    return {
      primary: `${stats.used} / ∞`,
      secondary: "Unlimited",
    };
  }
  return { primary: `${stats.used} / ${stats.limit}` };
}

export function buildPppRouterFreeCustomerStats(params: {
  used: number;
  limit: number | null;
}): PppRouterFreeCustomerStats {
  const { remaining, overLimit } = computeFreeCustomerQuotaRemaining(
    params.limit,
    params.used
  );
  return {
    used: params.used,
    limit: params.limit,
    remaining,
    overLimit,
    status: getFreeCustomerQuotaDisplayStatus(params),
  };
}

export async function getPppRouterFreeCustomerStatsForOwner(
  ownerUserId: number
): Promise<PppRouterFreeCustomerStats> {
  const [used, limit] = await Promise.all([
    countActiveFreeCustomersForOwner(ownerUserId),
    getFreeCustomerLimitForOwner(ownerUserId),
  ]);
  return buildPppRouterFreeCustomerStats({ used, limit });
}

export async function getPppFreeCustomerQuotaStats(
  ownerUserId: number
): Promise<PppFreeCustomerQuotaStats> {
  const quota = await getPppRouterFreeCustomerStatsForOwner(ownerUserId);
  return { ownerUserId, ...quota };
}
