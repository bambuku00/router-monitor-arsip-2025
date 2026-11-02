import { isPppIsolir } from "@/lib/ppp-isolir";
import { isPppSecretDisabled } from "@/lib/mikrotik-ppp-secret-active";

type PppFilterRow = {
  disabled: string;
  isIsolir?: boolean;
  profile?: string;
  active_records: unknown | null;
  pelanggan: { stop: boolean } | null;
};

/** Sama seperti tab Nonaktif (pelanggan ada, offline, bukan isolir, belum berhenti). */
export function isPppNonaktifTab(
  val: PppFilterRow,
  isolirProfileName?: string | null
): boolean {
  return (
    val.pelanggan != null &&
    !val.active_records &&
    !isPppIsolir(val, { isolirProfileName }) &&
    !isPppSecretDisabled(val) &&
    val.pelanggan.stop !== true
  );
}

/** Sama seperti tab Berhenti. */
export function isPppBerhentiTab(val: PppFilterRow): boolean {
  return val.pelanggan?.stop === true;
}

/** Gabungan kedua tab (untuk konsistensi bila dibutuhkan). */
export function isPppNonaktifOrBerhenti(
  val: PppFilterRow,
  isolirProfileName?: string | null
): boolean {
  return isPppNonaktifTab(val, isolirProfileName) || isPppBerhentiTab(val);
}
