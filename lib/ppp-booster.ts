const DAY_MS = 24 * 60 * 60 * 1000;

export function boosterEndsAt(days: number, now = new Date()): Date | null {
  if (!Number.isInteger(days) || days < 1 || days > 6) return null;
  return new Date(now.getTime() + days * DAY_MS);
}

/** Sisa hari ke atas. 0 berarti waktu booster sudah lewat. */
export function boosterDaysLeft(endsAt: Date, now = new Date()): number {
  const ms = endsAt.getTime() - now.getTime();
  if (ms <= 0) return 0;
  return Math.ceil(ms / DAY_MS);
}
