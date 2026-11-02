/**
 * Aturan mulai tagihan per pelanggan / mitra.
 * Default: tagihan pertama bulan yang jatuh-tempo-nya setelah tgl pemasangan + grace (30 hari).
 */

import { BillingStartMode } from "@prisma/client";

import { BILLING, TIME } from "@/lib/constants";
import { jatuhTempoForBillingPeriod } from "@/lib/billing-due-date";

function parseYmd(dateStr: string): { y: number; m: number; d: number } {
  const normalized = dateStr.slice(0, 10);
  const [y, m, d] = normalized.split("-").map(Number);
  return { y, m, d };
}

/** Tambah hari kalender pada tanggal YYYY-MM-DD (UTC date-only). */
export function addCalendarDays(dateStr: string, days: number): string {
  const { y, m, d } = parseYmd(dateStr);
  const ms = Date.UTC(y, m - 1, d) + days * TIME.ONE_DAY_MS;
  const dt = new Date(ms);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Periode tagihan pertama (YYYY-MM): bulan dengan jatuh tempo (tgl 20)
 * yang masih setelah (tgl pemasangan + graceDays).
 *
 * Contoh: pasang 2026-05-04 + 30 hari → grace selesai 2026-06-03 → tagihan pertama 2026-06 (jatuh tempo 20/6).
 */
export function getFirstBillingPeriodAfterGrace(
  tgl: string,
  graceDays: number = BILLING.BILLING_CYCLE_DAYS
): string {
  const graceEnd = addCalendarDays(tgl.slice(0, 10), graceDays);
  const { y, m } = parseYmd(tgl);
  let cy = y;
  let cm = m;

  for (let i = 0; i < 36; i++) {
    const period = `${cy}-${String(cm).padStart(2, "0")}`;
    if (jatuhTempoForBillingPeriod(period) > graceEnd) return period;
    cm += 1;
    if (cm > 12) {
      cm = 1;
      cy += 1;
    }
  }

  return `${cy}-${String(cm).padStart(2, "0")}`;
}

function maxPeriod(a: string, b: string): string {
  return a >= b ? a : b;
}

/** Batas hari pasang baru akun ISP. Tanggal 25 ikut bulan depan; di atas 25 dilewati. */
export const ISP_INSTALL_BILLING_CUTOFF_DAY = 25;

function shiftYearMonth(year: number, month: number, delta: number): string {
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Akun milik ISP: pasang tanggal 1–25 masuk tagihan bulan depan.
 * Pasang tanggal 26–31 tidak ikut bulan depan; tagihan pertama dua bulan kemudian.
 */
export function getIspFirstBillingPeriod(tgl: string): string {
  const { y, m, d } = parseYmd(tgl);
  const monthsAhead = d <= ISP_INSTALL_BILLING_CUTOFF_DAY ? 1 : 2;
  return shiftYearMonth(y, m, monthsAhead);
}

/** Returns YYYY-MM for the first month to bill. Mode dari mitra (User); null = NEXT_MONTH + grace. */
export function getFirstBillingMonth(params: {
  tgl: string;
  billingStartMode: BillingStartMode | null;
  billingStartDate: Date | null;
  ownedByIsp?: boolean;
}): string {
  if (params.ownedByIsp) return getIspFirstBillingPeriod(params.tgl);
  const mode = params.billingStartMode ?? "NEXT_MONTH";
  const { tgl, billingStartDate } = params;
  const graceFirst = getFirstBillingPeriodAfterGrace(tgl);

  switch (mode) {
    case "NEXT_MONTH":
      return graceFirst;
    case "IMMEDIATE": {
      // Mulai sekarang: tagihan boleh sejak bulan pemasangan (tanpa tunggu 30 hari)
      const { y, m } = parseYmd(tgl);
      return `${y}-${String(m).padStart(2, "0")}`;
    }
    case "CUSTOM_DATE": {
      if (!billingStartDate) {
        return graceFirst;
      }
      const custom = new Date(billingStartDate);
      const customMonth = new Date(custom.getFullYear(), custom.getMonth(), 1)
        .toLocaleDateString("fr-CA")
        .slice(0, 7);
      return maxPeriod(customMonth, graceFirst);
    }
    default:
      return getFirstBillingPeriodAfterGrace(tgl);
  }
}

/** Apakah pelanggan boleh ditagih untuk periode YYYY-MM (generate tagihan / cron). */
export function isPelangganEligibleForBillingPeriod(params: {
  tgl: string;
  period: string;
  billingStartMode?: BillingStartMode | null;
  billingStartDate?: Date | null;
  ownedByIsp?: boolean;
}): boolean {
  const period = params.period.trim().slice(0, 7);
  const minPeriod = getFirstBillingMonth({
    tgl: params.tgl,
    billingStartMode: params.billingStartMode ?? "NEXT_MONTH",
    billingStartDate: params.billingStartDate ?? null,
    ownedByIsp: params.ownedByIsp === true,
  });
  return period >= minPeriod;
}

export { billingMonthDatesFromFirstToNow } from "@/lib/billing-due-date";
