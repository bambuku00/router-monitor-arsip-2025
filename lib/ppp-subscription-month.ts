const NAMA_BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

export type SubscriptionMonthOption = {
  tanggal: string;
  count: number;
};

export function subscriptionDateKey(tgl: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(tgl.trim());
  if (!match) return null;
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (!Number.isInteger(day) || day < 1 || day > 31) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function subscriptionYearMonth(tgl: string): string | null {
  const key = subscriptionDateKey(tgl);
  if (!key) return null;
  return key.slice(0, 7);
}

/** Tanggal berlangganan yang benar-benar ada. Bulan sama dengan hari berbeda tetap terpisah. */
export function listSubscriptionMonths(dates: string[]): SubscriptionMonthOption[] {
  const counts = new Map<string, number>();
  for (const tgl of dates) {
    const tanggal = subscriptionDateKey(tgl);
    if (!tanggal) continue;
    counts.set(tanggal, (counts.get(tanggal) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([tanggal, count]) => ({ tanggal, count }));
}

export function formatSubscriptionDate(yyyyMmDd: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(yyyyMmDd);
  if (!match) return yyyyMmDd;
  const name = NAMA_BULAN[Number(match[2]) - 1];
  if (!name) return yyyyMmDd;
  return `${Number(match[3])} ${name} ${match[1]}`;
}

export function formatSubscriptionMonth(yyyyMm: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(yyyyMm);
  if (!match) return yyyyMm;
  const name = NAMA_BULAN[Number(match[2]) - 1];
  if (!name) return yyyyMm;
  return `${name} ${match[1]}`;
}

export function shiftSubscriptionYearMonth(yyyyMm: string, delta: number): string {
  const match = /^(\d{4})-(\d{2})$/.exec(yyyyMm);
  if (!match) return yyyyMm;
  const shifted = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1 + delta, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function assertSubscriptionDay(day: number): number {
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new Error("Tanggal harus antara 1 dan 31");
  }
  return day;
}

/**
 * Pindahkan tanggal berlangganan ke bulan yang dipilih.
 * Tanpa `day`, hari pelanggan tetap. Dengan `day`, semua memakai tanggal itu.
 * Keduanya dipotong jika bulan tujuan lebih pendek.
 */
export function subscriptionDateInMonth(
  tgl: string,
  year: number,
  month: number,
  day?: number | null
): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(tgl.trim());
  const storedDay = match ? Number(match[3]) : 1;
  const chosen = day == null ? storedDay : day;
  const safeDay = Number.isInteger(chosen) && chosen >= 1 ? chosen : 1;
  const lastDay = new Date(year, month, 0).getDate();
  const clamped = Math.min(safeDay, lastDay);
  return `${year}-${String(month).padStart(2, "0")}-${String(clamped).padStart(2, "0")}`;
}

export function assertBillingYearMonth(
  year: number,
  month: number
): { year: number; month: number } {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error("Tahun tidak valid");
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Bulan tidak valid");
  }
  return { year, month };
}

export function parseSubscriptionDate(value: string): {
  year: number;
  month: number;
  day: number;
  key: string;
} {
  const key = subscriptionDateKey(value);
  if (!key) throw new Error("Tanggal tidak valid");
  const [yearText, monthText, dayText] = key.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  assertBillingYearMonth(year, month);
  assertSubscriptionDay(day);
  return { year, month, day, key };
}

export function parseYearMonth(yyyyMm: string): { year: number; month: number } {
  const match = /^(\d{4})-(\d{2})$/.exec(yyyyMm);
  if (!match) throw new Error("Bulan tidak valid");
  return assertBillingYearMonth(Number(match[1]), Number(match[2]));
}
