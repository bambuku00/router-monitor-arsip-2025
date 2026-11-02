import { validateRequest } from "@/lib/auth";
import {
  getInvoiceSettingsForUser,
  toInvoiceSettingsDto,
  upsertInvoiceSettings,
} from "@/lib/invoice-settings";
import {
  INVOICE_LOGO_SIZE_DEFAULT,
  INVOICE_BG_OPACITY_DEFAULT,
  INVOICE_BG_SIZE_MM_DEFAULT,
  clampInvoiceLogoSize,
  clampInvoiceBgOpacity,
  clampInvoiceBgSizeMm,
} from "@/lib/invoice-assets";
import {
  INVOICE_UPLOAD_DIR,
  invoiceUploadDirForUser,
  isSafeInvoiceUploadFilename,
} from "@/lib/invoice-upload-path";
import prisma from "@/lib/prisma";
import { getOwnedResourcesUserId } from "@/lib/rbac";
import { validateFileUpload } from "@/lib/utils";
import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

function canEditInvoice(user: { role: string }) {
  return user.role === "Admin" || user.role === "Superadmin";
}

export async function GET() {
  const { user, session } = await validateRequest();
  if (!session || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canEditInvoice(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ownerId = getOwnedResourcesUserId(user);
  const [data, banksRaw] = await Promise.all([
    getInvoiceSettingsForUser(ownerId),
    prisma.bank.findMany({
      where: { userId: ownerId, deleted: false },
      orderBy: { id: "asc" },
      select: { bank: true, norek: true, nama: true, hideFromUnpaidInvoice: true },
    }),
  ]);
  return NextResponse.json({
    data,
    banks: banksRaw.map((bank) => ({
      nama: bank.bank,
      norek: bank.norek,
      namaPemilik: bank.nama,
      hideFromUnpaidInvoice: bank.hideFromUnpaidInvoice,
    })),
  });
}

export async function PUT(request: NextRequest) {
  const { user, session } = await validateRequest();
  if (!session || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canEditInvoice(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const ownerId = getOwnedResourcesUserId(user);
  const form = await request.formData();

  const logoFile = form.get("logo");
  const qrFile = form.get("qr");
  const bgFile = form.get("background");
  let logoFilename: string | null | undefined;
  let qrFilename: string | null | undefined;
  let bgFilename: string | null | undefined;

  const uploadDir = invoiceUploadDirForUser(ownerId);
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  if (logoFile instanceof File && logoFile.size > 0) {
    const buf = await logoFile.arrayBuffer();
    const validation = validateFileUpload(logoFile, { maxSize: 512 * 1024 }, buf);
    if (validation.error) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const ext = logoFile.name.split(".").pop()?.toLowerCase() ?? "png";
    logoFilename = `logo-${Date.now()}.${ext}`;
    if (!isSafeInvoiceUploadFilename(logoFilename)) {
      return NextResponse.json({ error: "Nama file tidak valid" }, { status: 400 });
    }
    fs.writeFileSync(path.join(uploadDir, logoFilename), new Uint8Array(buf));
  }

  if (qrFile instanceof File && qrFile.size > 0) {
    const buf = await qrFile.arrayBuffer();
    const validation = validateFileUpload(qrFile, { maxSize: 512 * 1024 }, buf);
    if (validation.error) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const ext = qrFile.name.split(".").pop()?.toLowerCase() ?? "png";
    qrFilename = `qr-${Date.now()}.${ext}`;
    if (!isSafeInvoiceUploadFilename(qrFilename)) {
      return NextResponse.json({ error: "Nama file tidak valid" }, { status: 400 });
    }
    fs.writeFileSync(path.join(uploadDir, qrFilename), new Uint8Array(buf));
  }

  if (bgFile instanceof File && bgFile.size > 0) {
    const buf = await bgFile.arrayBuffer();
    const validation = validateFileUpload(
      bgFile,
      { maxSize: 100 * 1024, allowedExtensions: ["png", "jpg", "jpeg"] },
      buf
    );
    if (validation.error) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const ext = bgFile.name.split(".").pop()?.toLowerCase() ?? "png";
    bgFilename = `bg-${Date.now()}.${ext}`;
    if (!isSafeInvoiceUploadFilename(bgFilename)) {
      return NextResponse.json({ error: "Nama file tidak valid" }, { status: 400 });
    }
    fs.writeFileSync(path.join(uploadDir, bgFilename), new Uint8Array(buf));
  }

  const parseBool = (key: string, fallback: boolean) => {
    const v = form.get(key);
    if (v === "true" || v === "1") return true;
    if (v === "false" || v === "0") return false;
    return fallback;
  };

  const parseNum = (key: string, fallback: number) => {
    const v = form.get(key);
    if (v == null || v === "") return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  const str = (key: string, fallback: string) => {
    const v = form.get(key);
    return typeof v === "string" ? v : fallback;
  };

  const bgSizeMm = clampInvoiceBgSizeMm(
    parseNum("bgSizeMm", INVOICE_BG_SIZE_MM_DEFAULT)
  );
  const bgOpacity = clampInvoiceBgOpacity(
    parseNum("bgOpacity", INVOICE_BG_OPACITY_DEFAULT)
  );

  const row = await upsertInvoiceSettings(ownerId, {
    ...(logoFilename !== undefined ? { logoFilename } : {}),
    ...(qrFilename !== undefined ? { qrFilename } : {}),
    ...(bgFilename !== undefined ? { bgFilename } : {}),
    logoSize: clampInvoiceLogoSize(parseNum("logoSize", INVOICE_LOGO_SIZE_DEFAULT)),
    bgWatermark: parseBool("bgWatermark", true),
    companyName: str("companyName", ""),
    companySlogan: str("companySlogan", ""),
    companyAddress1: str("companyAddress1", ""),
    companyAddress2: str("companyAddress2", ""),
    companyAddress3: str("companyAddress3", ""),
    signatureName: str("signatureName", ""),
    signaturePosition: str("signaturePosition", ""),
    cashPaymentNote: str("cashPaymentNote", ""),
    confirmationNumber: str("confirmationNumber", ""),
    paymentNotes: str("paymentNotes", ""),
    tandaTerima: str("tandaTerima", ""),
    ucapanLunas: str("ucapanLunas", ""),
    footerText: str("footerText", ""),
    ppnStatus: parseBool("ppnStatus", true),
    ppnValue: parseNum("ppnValue", 11),
    ppnCalculationMode:
      str("ppnCalculationMode", "after") === "before" ? "before" : "after",
    discountStatus: parseBool("discountStatus", false),
    discountType:
      str("discountType", "fixed") === "percentage" ? "percentage" : "fixed",
    discountValue: parseNum("discountValue", 0),
    bgSizeMm,
    bgOpacity,
  });

  return NextResponse.json({
    message: "Pengaturan invoice disimpan",
    data: toInvoiceSettingsDto(row, ownerId),
  });
}

// Ensure upload root exists at module load in dev
if (!fs.existsSync(INVOICE_UPLOAD_DIR)) {
  try {
    fs.mkdirSync(INVOICE_UPLOAD_DIR, { recursive: true });
  } catch {
    /* ignore */
  }
}
