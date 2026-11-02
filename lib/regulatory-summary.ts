import {
  computeRegulatoryAmounts,
  DEFAULT_REGULATORY_SETTINGS,
  formatRegulatoryBasis,
  formatRegulatoryPercent,
  type RegulatorySettingsInput,
} from "@/lib/regulatory-calc";
import { computeGrossRevenueForPeriod } from "@/lib/regulatory-revenue";
import prisma from "@/lib/prisma";

export type RegulatorySummary = {
  grossRevenue: number;
  bhpAmount: number;
  usoAmount: number;
  totalAmount: number;
  bhpEnabled: boolean;
  usoEnabled: boolean;
  bhpPercent: number;
  usoPercent: number;
  totalPercent: number;
  calculationBasis: string;
  calculationBasisKey: "INVOICE_CREATED" | "PAYMENT_RECEIVED";
};

export async function getEffectiveRegulatorySettings(
  mitraUserId: number
): Promise<RegulatorySettingsInput> {
  try {
    const settings = await prisma.regulatorySettings.findUnique({
      where: { userId: mitraUserId },
    });
    return settings ?? DEFAULT_REGULATORY_SETTINGS;
  } catch {
    return DEFAULT_REGULATORY_SETTINGS;
  }
}

export function buildRegulatorySummary(
  grossRevenue: number,
  settings: RegulatorySettingsInput
): RegulatorySummary {
  const amounts = computeRegulatoryAmounts(grossRevenue, settings);
  return {
    grossRevenue: amounts.grossRevenue,
    bhpAmount: amounts.bhpAmount,
    usoAmount: amounts.usoAmount,
    totalAmount: amounts.totalAmount,
    bhpEnabled: settings.bhpEnabled,
    usoEnabled: settings.usoEnabled,
    bhpPercent: settings.bhpPercent,
    usoPercent: settings.usoPercent,
    totalPercent: amounts.totalPercentApplied,
    calculationBasis: formatRegulatoryBasis(),
    calculationBasisKey: "INVOICE_CREATED",
  };
}

/** Ringkasan BHP/USO untuk laporan regulasi (basis dari pengaturan). */
export async function getRegulatorySummaryForMitra(
  mitraUserId: number,
  year: number,
  month: number
): Promise<RegulatorySummary> {
  try {
    const settings = await getEffectiveRegulatorySettings(mitraUserId);
    const grossRevenue = await computeGrossRevenueForPeriod(
      mitraUserId,
      year,
      month
    );
    return buildRegulatorySummary(grossRevenue, settings);
  } catch {
    return buildRegulatorySummary(0, DEFAULT_REGULATORY_SETTINGS);
  }
}

/**
 * BHP/USO di halaman Pembayaran — gross mengikuti angka tagihan yang sama
 * (total tagihan atau terbayar) supaya potongan Pendapatan Bersih konsisten.
 */
export async function getRegulatorySummaryForPembayaran(
  mitraUserId: number,
  totalTagihan: number
): Promise<RegulatorySummary> {
  const settings = await getEffectiveRegulatorySettings(mitraUserId);
  return buildRegulatorySummary(totalTagihan, settings);
}

export function formatRegulatoryPercentLabel(
  enabled: boolean,
  percent: number
): string {
  return enabled ? formatRegulatoryPercent(percent) : "nonaktif";
}
