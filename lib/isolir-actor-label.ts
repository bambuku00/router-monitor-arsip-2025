/** Label pelaku isolir untuk tampilan. `system` adalah job otomatis. */
export function formatIsolirOlehLabel(
  executedBy: string | null | undefined
): string | null {
  const value = executedBy?.trim();
  if (!value || value === "dry-run") return null;
  if (value === "system") return "Sistem (otomatis)";
  return value;
}

/** Kolom pelaku di halaman riwayat isolir. */
export function formatIsolirLogActor(
  executedBy: string | null | undefined,
  dryRun = false
): string {
  const label = formatIsolirOlehLabel(executedBy);
  if (label) return label;
  if (dryRun || executedBy?.trim() === "dry-run") return "Uji coba";
  return "—";
}

/** Awal dan akhir bulan tagihan dalam zona Asia/Jakarta. */
export function jakartaMonthRange(bulan: string): { start: Date; end: Date } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(bulan);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  const start = new Date(`${match[1]}-${match[2]}-01T00:00:00+07:00`);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const end = new Date(
    `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00+07:00`
  );
  return { start, end };
}

/** Nama singkat untuk baris pembayaran, misalnya `DEMO`. */
export function formatIsolirOlehShort(
  executedBy: string | null | undefined
): string | null {
  const label = formatIsolirOlehLabel(executedBy);
  if (!label) return null;
  const paren = label.indexOf(" (");
  return paren > 0 ? label.slice(0, paren) : label;
}

export function formatIsolirActor(user: {
  nama?: string | null;
  user?: string | null;
}): string {
  const nama = user.nama?.trim() || "Pengguna";
  const username = user.user?.trim();
  return username ? `${nama} (${username})` : nama;
}
