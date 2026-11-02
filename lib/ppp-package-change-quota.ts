import prisma from "@/lib/prisma";

/** Awal bulan kalender Asia/Jakarta. */
export function jakartaMonthStart(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  return new Date(Date.UTC(year, month - 1, 1, -7, 0, 0, 0));
}

/** null = tidak dibatasi. 0 = tidak boleh. */
export function packageChangeAllowed(used: number, limit: number | null): boolean {
  if (limit == null) return true;
  return used < limit;
}

export function packageChangeQuotaMessage(
  direction: "upgrade" | "downgrade",
  used: number,
  limit: number
): string {
  if (limit <= 0) {
    return "Upgrade dan downgrade dimatikan untuk mitra ini.";
  }
  const label = direction === "downgrade" ? "Downgrade" : "Upgrade";
  return `Batas ${label} bulan ini sudah habis (${used} dari ${limit}).`;
}

export async function countPppPackageChanges(ownerUserId: number): Promise<{
  upgradeUsed: number;
  downgradeUsed: number;
}> {
  const grouped = await prisma.pppPackageChange.groupBy({
    by: ["direction"],
    where: { ownerUserId, created: { gte: jakartaMonthStart() } },
    _count: { _all: true },
  });
  let upgradeUsed = 0;
  let downgradeUsed = 0;
  for (const row of grouped) {
    if (row.direction === "upgrade") upgradeUsed = row._count._all;
    if (row.direction === "downgrade") downgradeUsed = row._count._all;
  }
  return { upgradeUsed, downgradeUsed };
}

export async function checkPppPackageChangeQuota(
  ownerUserId: number,
  direction: "upgrade" | "downgrade"
): Promise<
  | { ok: true; limit: number | null; upgradeUsed: number; downgradeUsed: number }
  | { ok: false; error: string; limit: number; upgradeUsed: number; downgradeUsed: number }
> {
  const owner = await prisma.user.findUnique({
    where: { id: ownerUserId },
    select: { pppPackageChangeLimit: true },
  });
  const limit = owner?.pppPackageChangeLimit ?? null;
  const counts = await countPppPackageChanges(ownerUserId);
  const used = direction === "downgrade" ? counts.downgradeUsed : counts.upgradeUsed;
  if (limit != null && !packageChangeAllowed(used, limit)) {
    return {
      ok: false,
      error: packageChangeQuotaMessage(direction, used, limit),
      limit,
      ...counts,
    };
  }
  return { ok: true, limit, ...counts };
}
