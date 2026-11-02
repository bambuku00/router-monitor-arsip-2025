import path from "node:path";

/** Nama file identitas/NPWP: basename saja, tanpa path / traversal. */
const SAFE_IDENTITY_FILENAME =
  /^[a-zA-Z0-9][a-zA-Z0-9._-]*\.(jpe?g|png|pdf)$/i;

/**
 * Validasi konsisten untuk baca/tulis upload identitas (hindari path traversal & ekstensi aneh).
 */
export function isSafeIdentityUploadFilename(raw: string): boolean {
  if (!raw || raw !== raw.trim()) return false;
  if (raw.includes("..") || raw.includes("/") || raw.includes("\\")) return false;
  const base = path.basename(raw);
  return base === raw && SAFE_IDENTITY_FILENAME.test(base);
}
