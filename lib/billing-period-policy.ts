import prisma from "@/lib/prisma";

/** Daftar YYYY-MM untuk satu tahun kalender. */
export function billingMonthsForYear(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, "0");
    return `${year}-${m}`;
  });
}

export type BillingPeriodPolicy = {
  yearRestrict: number | null;
  allowedMonths: string[] | null;
};

/** Pengaturan periode tagihan global (baris Superadmin ISP). */
export async function getBillingPeriodPolicy(): Promise<BillingPeriodPolicy> {
  const row = await prisma.user.findFirst({
    where: { role: "Superadmin", disabled: false },
    orderBy: { id: "asc" },
    select: { billingYearRestrict: true },
  });
  const year = row?.billingYearRestrict ?? null;
  if (year == null || year < 2000 || year > 2100) {
    return { yearRestrict: null, allowedMonths: null };
  }
  return {
    yearRestrict: year,
    allowedMonths: billingMonthsForYear(year),
  };
}

export function clampBillingMonth(
  bulan: string,
  allowedMonths: readonly string[] | null | undefined
): string {
  if (!allowedMonths?.length) return bulan;
  if (/^\d{4}-\d{2}$/.test(bulan) && allowedMonths.includes(bulan)) {
    return bulan;
  }
  return allowedMonths[allowedMonths.length - 1]!;
}

export function defaultBillingMonth(
  allowedMonths: readonly string[] | null | undefined
): string {
  if (allowedMonths?.length) {
    return allowedMonths[allowedMonths.length - 1]!;
  }
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}
