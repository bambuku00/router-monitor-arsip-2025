import { BILLING } from "@/lib/constants";

export function billingPeriodFromJatuhTempo(jatuh_tempo: string): string {
  return jatuh_tempo.trim().slice(0, 7);
}

/** Jatuh tempo standar tagihan: tanggal 20 setiap bulan (YYYY-MM-20). */
export function jatuhTempoForBillingPeriod(periodOrDate: string): string {
  const period = billingPeriodFromJatuhTempo(periodOrDate);
  return `${period}-${String(BILLING.DUE_DAY_OF_MONTH).padStart(2, "0")}`;
}

/** Rentang jatuh tempo satu bulan kalender (termasuk tgl 1 dan 20). */
export function monthJatuhTempoRange(period: string) {
  const [year, month] = billingPeriodFromJatuhTempo(period).split("-").map(Number);
  return {
    gte: new Date(year, month - 1, 1).toLocaleDateString("fr-CA"),
    lte: new Date(year, month, 0).toLocaleDateString("fr-CA"),
  };
}

function startOfMonth(year: number, monthIndex: number): Date {
  return new Date(year, monthIndex, 1);
}

/** Sampai bulan mana backfill boleh buat tagihan (termasuk bulan depan jika itu bulan tagihan pertama). */
function backfillEndMonth(firstMonthStr: string, now = new Date()): Date {
  const [y, m] = firstMonthStr.split("-").map(Number);
  const first = startOfMonth(y, m - 1);
  const current = startOfMonth(now.getFullYear(), now.getMonth());

  if (first <= current) {
    return current;
  }

  const nextMonth = startOfMonth(
    now.getFullYear(),
    now.getMonth() + 1
  );
  if (first.getTime() === nextMonth.getTime()) {
    return first;
  }

  return current;
}

/** Daftar jatuh tempo (tgl 20) dari bulan pertama eligible sampai bulan berjalan (+ bulan depan jika itu tagihan pertama). */
export function billingMonthJatuhTempoDatesFromFirstToNow(
  firstMonthStr: string,
  now = new Date()
): string[] {
  const [y, m] = firstMonthStr.split("-").map(Number);
  const first = startOfMonth(y, m - 1);
  const end = backfillEndMonth(firstMonthStr, now);
  const months: string[] = [];
  let current = new Date(first);

  while (current <= end) {
    const period = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`;
    months.push(jatuhTempoForBillingPeriod(period));
    current = startOfMonth(current.getFullYear(), current.getMonth() + 1);
  }
  return months;
}

/** Pembayaran di muka paling jauh: bulan tagihan ini plus bulan berikutnya. */
export const MAX_PREPAID_MONTHS = 6;

export function addBillingMonths(periodOrDate: string, offset: number): string {
  const [year, month] = billingPeriodFromJatuhTempo(periodOrDate)
    .split("-")
    .map(Number);
  const date = new Date(year, month - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Periode YYYY-MM mulai bulan tagihan yang dibayar, sebanyak `count` bulan (1–6). */
export function prepaidBillingPeriods(
  periodOrDate: string,
  count: number
): string[] {
  const months = Math.min(
    MAX_PREPAID_MONTHS,
    Math.max(1, Math.trunc(count))
  );
  return Array.from({ length: months }, (_, index) =>
    addBillingMonths(periodOrDate, index)
  );
}

export function formatBillingPeriodLabel(period: string): string {
  const [year, month] = billingPeriodFromJatuhTempo(period).split("-").map(Number);
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

/** @deprecated Gunakan billingMonthJatuhTempoDatesFromFirstToNow */
export const billingMonthDatesFromFirstToNow =
  billingMonthJatuhTempoDatesFromFirstToNow;

/** @deprecated Gunakan jatuhTempoForBillingPeriod */
export const jatuhTempoFirstOfMonth = jatuhTempoForBillingPeriod;
