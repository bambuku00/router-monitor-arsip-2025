import { billingPeriodFromJatuhTempo } from "@/lib/billing-due-date";

function formatYearMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Bulan berjalan, lalu bulan sebelumnya. Urutan ini dipakai filter petugas. */
export function petugasVisibleMonths(now = new Date()): [string, string] {
  const current = new Date(now.getFullYear(), now.getMonth(), 1);
  const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return [formatYearMonth(current), formatYearMonth(previous)];
}

export function petugasBulanBerjalan(now = new Date()): string {
  return formatYearMonth(now);
}

/** Petugas hanya mencatat tagihan bulan kalender yang sedang berjalan. */
export function petugasBolehMencatatBayar(
  jatuhTempo: string,
  now = new Date()
): boolean {
  return billingPeriodFromJatuhTempo(jatuhTempo) === petugasBulanBerjalan(now);
}

export function clampPetugasBulan(
  value: string | null | undefined,
  now = new Date()
): string {
  const [current, previous] = petugasVisibleMonths(now);
  if (value === current || value === previous) return value;
  return current;
}
