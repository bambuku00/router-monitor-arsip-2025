import type { RegulatoryCalculationBasis, RegulatorySettings } from "@prisma/client";

export type RegulatorySettingsInput = Pick<
  RegulatorySettings,
  "bhpEnabled" | "bhpPercent" | "usoEnabled" | "usoPercent" | "calculationBasis"
>;

export type RegulatoryAmounts = {
  grossRevenue: number;
  bhpAmount: number;
  usoAmount: number;
  totalAmount: number;
  bhpPercentApplied: number;
  usoPercentApplied: number;
  totalPercentApplied: number;
};

export function validateRegulatoryPercents(
  bhpPercent: number,
  usoPercent: number
): string | null {
  for (const [label, value] of [
    ["BHP", bhpPercent],
    ["USO", usoPercent],
  ] as const) {
    if (Number.isNaN(value) || value < 0) {
      return `Persentase ${label} tidak boleh minus`;
    }
    if (value > 100) {
      return `Persentase ${label} maksimal 100%`;
    }
  }
  return null;
}

export function validateRegulatoryPeriod(
  month: number,
  year: number
): string | null {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return "Tahun tidak valid";
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return "Bulan wajib diisi (1–12)";
  }
  return null;
}

export function computeRegulatoryAmounts(
  grossRevenue: number,
  settings: RegulatorySettingsInput
): RegulatoryAmounts {
  const gross = Math.max(0, grossRevenue);
  const bhpAmount = settings.bhpEnabled
    ? Math.round((gross * settings.bhpPercent) / 100)
    : 0;
  const usoAmount = settings.usoEnabled
    ? Math.round((gross * settings.usoPercent) / 100)
    : 0;
  const bhpPercentApplied = settings.bhpEnabled ? settings.bhpPercent : 0;
  const usoPercentApplied = settings.usoEnabled ? settings.usoPercent : 0;

  return {
    grossRevenue: gross,
    bhpAmount,
    usoAmount,
    totalAmount: bhpAmount + usoAmount,
    bhpPercentApplied,
    usoPercentApplied,
    totalPercentApplied: bhpPercentApplied + usoPercentApplied,
  };
}

export function formatRegulatoryPercent(value: number): string {
  return `${value.toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}%`;
}

export function formatRegulatoryBasis(
  _basis?: RegulatoryCalculationBasis
): string {
  return "Total tagihan bulanan (Pembayaran Mitra)";
}

export const DEFAULT_REGULATORY_SETTINGS: RegulatorySettingsInput = {
  bhpEnabled: true,
  bhpPercent: 0.5,
  usoEnabled: true,
  usoPercent: 1.25,
  calculationBasis: "INVOICE_CREATED",
};
