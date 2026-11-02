import prisma from "@/lib/prisma";
import { jatuhTempoForBillingPeriod } from "@/lib/billing-due-date";

export const BILLING_GENERATE_DAY_MIN = 1;
export const BILLING_GENERATE_DAY_MAX = 28;
export const DEFAULT_BILLING_GENERATE_DAY = 25;
export const DEFAULT_BILLING_GENERATE_HOUR = 1;

export type JakartaBillContext = {
  year: number;
  month: number;
  day: number;
  hour: number;
  period: string;
  tanggalStr: string;
  lastDayStr: string;
  firstOfNextMonth: Date;
};

export function validateBillingGenerateDay(
  day: number | null | undefined
): string | null {
  if (day == null) return null;
  if (
    !Number.isInteger(day) ||
    day < BILLING_GENERATE_DAY_MIN ||
    day > BILLING_GENERATE_DAY_MAX
  ) {
    return `Tanggal generate harus ${BILLING_GENERATE_DAY_MIN}–${BILLING_GENERATE_DAY_MAX}.`;
  }
  return null;
}

export function validateBillingGenerateHour(hour: number): string | null {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    return "Jam generate harus 0–23.";
  }
  return null;
}

export async function getOrCreateAppSettings() {
  return prisma.appSettings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      billingGenerateDay: DEFAULT_BILLING_GENERATE_DAY,
      billingGenerateHour: DEFAULT_BILLING_GENERATE_HOUR,
    },
    update: {},
  });
}

export function getJakartaBillContext(now = new Date()): JakartaBillContext {
  const jakartaDateStr = now.toLocaleDateString("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [year, month, day] = jakartaDateStr.split("-").map(Number);
  const hour = parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Jakarta",
      hour: "numeric",
      hour12: false,
    }).format(now),
    10
  );
  const period = `${year}-${String(month).padStart(2, "0")}`;
  const tanggalStr = jatuhTempoForBillingPeriod(period);
  const lastDayOfBillMonth = new Date(year, month, 0);
  const lastDayStr = `${period}-${String(lastDayOfBillMonth.getDate()).padStart(2, "0")}`;

  return {
    year,
    month,
    day,
    hour,
    period,
    tanggalStr,
    lastDayStr,
    firstOfNextMonth: new Date(year, month, 1),
  };
}

/** Konteks tagihan untuk periode YYYY-MM (manual generate dari halaman pembayaran). */
export function getBillContextForPeriod(period: string): JakartaBillContext {
  if (!/^\d{4}-\d{2}$/.test(period.trim())) {
    return getJakartaBillContext();
  }
  const nowCtx = getJakartaBillContext();
  const [year, month] = period.trim().split("-").map(Number);
  const periodNorm = `${year}-${String(month).padStart(2, "0")}`;
  const tanggalStr = jatuhTempoForBillingPeriod(periodNorm);
  const lastDayOfBillMonth = new Date(year, month, 0);
  const lastDayStr = `${periodNorm}-${String(lastDayOfBillMonth.getDate()).padStart(2, "0")}`;

  return {
    year,
    month,
    day: nowCtx.day,
    hour: nowCtx.hour,
    period: periodNorm,
    tanggalStr,
    lastDayStr,
    firstOfNextMonth: new Date(year, month, 1),
  };
}

export function resolveMitraGenerateDay(
  mitraDay: number | null | undefined,
  globalDay: number
): number {
  return mitraDay ?? globalDay;
}
