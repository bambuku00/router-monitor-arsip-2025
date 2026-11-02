import prisma from "@/lib/prisma";
import {
  INVOICE_DEFAULT_BG,
  INVOICE_DEFAULT_LOGO,
  INVOICE_DEFAULT_QR,
  INVOICE_BG_OPACITY_DEFAULT,
  INVOICE_BG_SIZE_MM_DEFAULT,
  clampInvoiceBgOpacity,
  clampInvoiceBgSizeMm,
  INVOICE_LOGO_SIZE_DEFAULT,
} from "@/lib/invoice-assets";
import type { InvoiceSettings } from "@prisma/client";

export type InvoiceSettingsDto = {
  logoSize: number;
  logoUrl: string;
  qrUrl: string;
  bgUrl: string;
  logoFilename: string | null;
  qrFilename: string | null;
  bgFilename: string | null;
  bgWatermark: boolean;
  /** Lebar watermark di invoice (mm). */
  bgSizeMm: number;
  /** Opacity watermark 5–100 (%). */
  bgOpacity: number;
  companyName: string;
  companySlogan: string;
  companyAddress1: string;
  companyAddress2: string;
  companyAddress3: string;
  signatureName: string;
  signaturePosition: string;
  cashPaymentNote: string;
  confirmationNumber: string;
  paymentNotes: string;
  tandaTerima: string;
  ucapanLunas: string;
  footerText: string;
  ppnStatus: boolean;
  ppnValue: number;
  ppnCalculationMode: "before" | "after";
  discountStatus: boolean;
  discountType: "fixed" | "percentage";
  discountValue: number;
};

export function invoiceAssetUrl(
  userId: number,
  filename: string | null | undefined,
  kind: "logo" | "qr" | "bg"
) {
  if (filename) {
    return `/api/uploads/invoice/${userId}/${encodeURIComponent(filename)}`;
  }
  if (kind === "logo") return INVOICE_DEFAULT_LOGO;
  if (kind === "qr") return INVOICE_DEFAULT_QR;
  return INVOICE_DEFAULT_BG;
}

export function toInvoiceSettingsDto(
  row: InvoiceSettings,
  userId: number
): InvoiceSettingsDto {
  return {
    logoSize: row.logoSize,
    logoUrl: invoiceAssetUrl(userId, row.logoFilename, "logo"),
    qrUrl: invoiceAssetUrl(userId, row.qrFilename, "qr"),
    bgUrl: invoiceAssetUrl(userId, row.bgFilename, "bg"),
    logoFilename: row.logoFilename,
    qrFilename: row.qrFilename,
    bgFilename: row.bgFilename,
    bgWatermark: row.bgWatermark,
    bgSizeMm: clampInvoiceBgSizeMm(row.bgSizeMm),
    bgOpacity: clampInvoiceBgOpacity(row.bgOpacity),
    companyName: row.companyName,
    companySlogan: row.companySlogan,
    companyAddress1: row.companyAddress1,
    companyAddress2: row.companyAddress2,
    companyAddress3: row.companyAddress3,
    signatureName: row.signatureName,
    signaturePosition: row.signaturePosition,
    cashPaymentNote: row.cashPaymentNote,
    confirmationNumber: row.confirmationNumber,
    paymentNotes: row.paymentNotes,
    tandaTerima: row.tandaTerima,
    ucapanLunas: row.ucapanLunas,
    footerText: row.footerText,
    ppnStatus: row.ppnStatus,
    ppnValue: row.ppnValue,
    ppnCalculationMode:
      row.ppnCalculationMode === "before" ? "before" : "after",
    discountStatus: row.discountStatus,
    discountType:
      row.discountType === "percentage" ? "percentage" : "fixed",
    discountValue: row.discountValue,
  };
}

export async function getInvoiceSettingsForUser(
  userId: number
): Promise<InvoiceSettingsDto> {
  const row = await prisma.invoiceSettings.findUnique({ where: { userId } });
  if (!row) {
    return toInvoiceSettingsDto(
      {
        id: 0,
        userId,
        logoSize: INVOICE_LOGO_SIZE_DEFAULT,
        logoFilename: null,
        qrFilename: null,
        bgFilename: null,
        bgWatermark: true,
        bgSizeMm: INVOICE_BG_SIZE_MM_DEFAULT,
        bgOpacity: INVOICE_BG_OPACITY_DEFAULT,
        companyName: "PT. WAHYU ADIDAYA NETWORK",
        companySlogan: "Internet Service Provider",
        companyAddress1: "JLN RADEN WIJAYA RT 001 RW 003 GIRI",
        companyAddress2: "BANYUWANGI",
        companyAddress3: "KODE POS 68423",
        signatureName: "admin",
        signaturePosition: "Finance",
        cashPaymentNote:
          "Pembayaran secara TUNAI dapat melalui mitra resmi atau ke kantor kami",
        confirmationNumber: "0822-3299-7497",
        paymentNotes:
          "1. Transfer sejumlah yang tertera diatas sampai digit terakhir.\n2. Bayarlah sebelum tanggal jatuh tempo, agar terhindar dari isolir oleh sistem",
        tandaTerima:
          "Tanda Terima ini adalah sah dan harap simpan sebagai bukti pembayaran",
        ucapanLunas:
          "Kami sampaikan terima kasih atas pembayaran tagihan yang bapak/ibu lakukan, dan layanan dapat di gunakan sampai tagihan berikutnya",
        footerText: "SUPPORT BY : WINET - ISP BILLING SYSTEM",
        ppnStatus: true,
        ppnValue: 11,
        ppnCalculationMode: "after",
        discountStatus: false,
        discountType: "fixed",
        discountValue: 0,
        created: new Date(),
        updated: new Date(),
      },
      userId
    );
  }
  return toInvoiceSettingsDto(row, userId);
}

export async function upsertInvoiceSettings(
  userId: number,
  data: Partial<
    Omit<InvoiceSettingsDto, "logoUrl" | "qrUrl" | "bgUrl"> & {
      logoFilename?: string | null;
      qrFilename?: string | null;
      bgFilename?: string | null;
    }
  >
) {
  const { logoFilename, qrFilename, bgFilename, ...rest } = data;

  return prisma.invoiceSettings.upsert({
    where: { userId },
    create: {
      userId,
      logoFilename: logoFilename ?? null,
      qrFilename: qrFilename ?? null,
      bgFilename: bgFilename ?? null,
      logoSize: rest.logoSize ?? INVOICE_LOGO_SIZE_DEFAULT,
      bgWatermark: rest.bgWatermark ?? true,
      bgSizeMm: clampInvoiceBgSizeMm(rest.bgSizeMm ?? INVOICE_BG_SIZE_MM_DEFAULT),
      bgOpacity: clampInvoiceBgOpacity(
        rest.bgOpacity ?? INVOICE_BG_OPACITY_DEFAULT
      ),
      companyName: rest.companyName ?? "PT. WAHYU ADIDAYA NETWORK",
      companySlogan: rest.companySlogan ?? "Internet Service Provider",
      companyAddress1: rest.companyAddress1 ?? "",
      companyAddress2: rest.companyAddress2 ?? "",
      companyAddress3: rest.companyAddress3 ?? "",
      signatureName: rest.signatureName ?? "admin",
      signaturePosition: rest.signaturePosition ?? "Finance",
      cashPaymentNote: rest.cashPaymentNote ?? "",
      confirmationNumber: rest.confirmationNumber ?? "",
      paymentNotes: rest.paymentNotes ?? "",
      tandaTerima: rest.tandaTerima ?? "",
      ucapanLunas: rest.ucapanLunas ?? "",
      footerText: rest.footerText ?? "",
      ppnStatus: rest.ppnStatus ?? true,
      ppnValue: rest.ppnValue ?? 11,
      ppnCalculationMode: rest.ppnCalculationMode ?? "after",
      discountStatus: rest.discountStatus ?? false,
      discountType: rest.discountType ?? "fixed",
      discountValue: rest.discountValue ?? 0,
    },
    update: {
      ...(logoFilename !== undefined ? { logoFilename } : {}),
      ...(qrFilename !== undefined ? { qrFilename } : {}),
      ...(bgFilename !== undefined ? { bgFilename } : {}),
      ...(rest.logoSize !== undefined ? { logoSize: rest.logoSize } : {}),
      ...(rest.bgWatermark !== undefined
        ? { bgWatermark: rest.bgWatermark }
        : {}),
      ...(rest.bgSizeMm !== undefined
        ? { bgSizeMm: clampInvoiceBgSizeMm(rest.bgSizeMm) }
        : {}),
      ...(rest.bgOpacity !== undefined
        ? { bgOpacity: clampInvoiceBgOpacity(rest.bgOpacity) }
        : {}),
      ...(rest.companyName !== undefined
        ? { companyName: rest.companyName }
        : {}),
      ...(rest.companySlogan !== undefined
        ? { companySlogan: rest.companySlogan }
        : {}),
      ...(rest.companyAddress1 !== undefined
        ? { companyAddress1: rest.companyAddress1 }
        : {}),
      ...(rest.companyAddress2 !== undefined
        ? { companyAddress2: rest.companyAddress2 }
        : {}),
      ...(rest.companyAddress3 !== undefined
        ? { companyAddress3: rest.companyAddress3 }
        : {}),
      ...(rest.signatureName !== undefined
        ? { signatureName: rest.signatureName }
        : {}),
      ...(rest.signaturePosition !== undefined
        ? { signaturePosition: rest.signaturePosition }
        : {}),
      ...(rest.cashPaymentNote !== undefined
        ? { cashPaymentNote: rest.cashPaymentNote }
        : {}),
      ...(rest.confirmationNumber !== undefined
        ? { confirmationNumber: rest.confirmationNumber }
        : {}),
      ...(rest.paymentNotes !== undefined
        ? { paymentNotes: rest.paymentNotes }
        : {}),
      ...(rest.tandaTerima !== undefined ? { tandaTerima: rest.tandaTerima } : {}),
      ...(rest.ucapanLunas !== undefined ? { ucapanLunas: rest.ucapanLunas } : {}),
      ...(rest.footerText !== undefined ? { footerText: rest.footerText } : {}),
      ...(rest.ppnStatus !== undefined ? { ppnStatus: rest.ppnStatus } : {}),
      ...(rest.ppnValue !== undefined ? { ppnValue: rest.ppnValue } : {}),
      ...(rest.ppnCalculationMode !== undefined
        ? { ppnCalculationMode: rest.ppnCalculationMode }
        : {}),
      ...(rest.discountStatus !== undefined
        ? { discountStatus: rest.discountStatus }
        : {}),
      ...(rest.discountType !== undefined
        ? { discountType: rest.discountType }
        : {}),
      ...(rest.discountValue !== undefined
        ? { discountValue: rest.discountValue }
        : {}),
    },
  });
}
