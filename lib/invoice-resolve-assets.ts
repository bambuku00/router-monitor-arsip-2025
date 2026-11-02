import type { InvoiceSettingsDto } from "@/lib/invoice-settings";
import type { InvoiceHtmlAssets } from "@/lib/invoice-html";
import { invoiceUploadDirForUser } from "@/lib/invoice-upload-path";
import bwipjs from "bwip-js";
import fs from "node:fs";
import path from "node:path";

const STATIC_ASSETS_CACHE_MAX = 64;
const staticAssetsCache = new Map<
  string,
  Pick<InvoiceHtmlAssets, "logoSrc" | "qrSrc" | "bgSrc">
>();

function assetCacheKey(userId: number, settings: InvoiceSettingsDto) {
  return [
    userId,
    settings.logoFilename ?? "",
    settings.qrFilename ?? "",
    settings.bgFilename ?? "",
    settings.bgWatermark ? "1" : "0",
  ].join("|");
}

function rememberStaticAssets(
  key: string,
  assets: Pick<InvoiceHtmlAssets, "logoSrc" | "qrSrc" | "bgSrc">
) {
  if (staticAssetsCache.size >= STATIC_ASSETS_CACHE_MAX) {
    const oldest = staticAssetsCache.keys().next().value;
    if (oldest) staticAssetsCache.delete(oldest);
  }
  staticAssetsCache.set(key, assets);
}

function mimeForExt(ext: string) {
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  return "image/png";
}

function fileToDataUri(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  const mime = mimeForExt(path.extname(filePath).toLowerCase());
  return `data:${mime};base64,${buf.toString("base64")}`;
}

function resolveFile(
  uploadDir: string,
  filename: string | null | undefined,
  defaultPublicRelative: string,
  cwd: string
) {
  if (filename) {
    const custom = path.join(uploadDir, filename);
    if (fs.existsSync(custom)) return custom;
  }
  const fallback = path.join(cwd, "public", defaultPublicRelative);
  return fs.existsSync(fallback) ? fallback : null;
}

export async function invoiceBarcodeDataUri(text: string): Promise<string> {
  const png = await bwipjs.toBuffer({
    bcid: "code128",
    text: text || "-",
    scale: 3,
    height: 8,
    includetext: false,
  });
  return `data:image/png;base64,${png.toString("base64")}`;
}

export async function resolveInvoiceHtmlAssets(
  userId: number,
  settings: InvoiceSettingsDto,
  barcodeText: string,
  cwd = process.cwd()
): Promise<InvoiceHtmlAssets> {
  const cacheKey = assetCacheKey(userId, settings);
  let staticAssets = staticAssetsCache.get(cacheKey);

  if (!staticAssets) {
    const uploadDir = invoiceUploadDirForUser(userId);

    const logoFile = resolveFile(
      uploadDir,
      settings.logoFilename,
      "invoice-defaults/logo.png",
      cwd
    );
    const qrFile = resolveFile(
      uploadDir,
      settings.qrFilename,
      "invoice-defaults/qr-winet.png",
      cwd
    );
    const bgFile = settings.bgWatermark
      ? resolveFile(
          uploadDir,
          settings.bgFilename,
          "invoice-defaults/bg.png",
          cwd
        )
      : null;

    const defaultLogo = path.join(cwd, "public", "invoice-defaults/logo.png");
    const defaultQr = path.join(cwd, "public", "invoice-defaults/qr-winet.png");

    staticAssets = {
      logoSrc: fileToDataUri(logoFile ?? defaultLogo),
      qrSrc: fileToDataUri(qrFile ?? defaultQr),
      bgSrc: bgFile ? fileToDataUri(bgFile) : null,
    };
    rememberStaticAssets(cacheKey, staticAssets);
  }

  return {
    ...staticAssets,
    barcodeSrc: await invoiceBarcodeDataUri(barcodeText),
  };
}
