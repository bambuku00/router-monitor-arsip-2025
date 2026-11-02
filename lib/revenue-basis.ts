import type { RevenueBasis } from "@prisma/client";

export const REVENUE_BASIS_LABELS: Record<RevenueBasis, string> = {
  INVOICE: "Berdasarkan Tagihan Terbit",
  PAID: "Berdasarkan Pembayaran Masuk",
};

/** Label ringkas untuk badge UI (pembayaran, dll.). */
export const REVENUE_BASIS_SHORT_LABELS: Record<RevenueBasis, string> = {
  INVOICE: "Tagihan Terbit",
  PAID: "Pembayaran Masuk",
};

export const REVENUE_BASIS_TOOLTIPS: Record<RevenueBasis, string> = {
  INVOICE: "Bagi hasil dihitung saat tagihan terbit.",
  PAID: "Bagi hasil dihitung dari tagihan terbayar saja.",
};

export function normalizeRevenueBasis(
  basis: RevenueBasis | null | undefined
): RevenueBasis {
  return basis === "PAID" ? "PAID" : "INVOICE";
}

export function isPaidRevenueBasis(
  basis: RevenueBasis | null | undefined
): boolean {
  return normalizeRevenueBasis(basis) === "PAID";
}

/** Validasi persentase mitra (sisanya otomatis ke kantor pusat = 100%). */
export function validateMitraOmsetPercent(
  omset: number | null | undefined
): string | null {
  if (omset == null || omset === ("" as unknown as number)) return null;
  const n = Number(omset);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    return "Persentase mitra harus 0–100 (mitra + kantor pusat = 100%).";
  }
  return null;
}
