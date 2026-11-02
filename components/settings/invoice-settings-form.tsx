"use client";

import InvoiceTemplate from "@/components/pembayaran/invoice/invoice-template";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import type { InvoiceBankRow, InvoiceData } from "@/lib/invoice-data";
import { computeInvoiceNominal } from "@/lib/invoice-data";
import { banksVisibleOnUnpaidInvoice } from "@/lib/invoice-banks";
import type { InvoiceSettingsDto } from "@/lib/invoice-settings";
import {
  INVOICE_LOGO_SIZE_DEFAULT,
  INVOICE_LOGO_SIZE_MAX,
  INVOICE_LOGO_SIZE_MIN,
  INVOICE_BG_SIZE_MM_MIN,
  INVOICE_BG_SIZE_MM_MAX,
  INVOICE_BG_SIZE_MM_DEFAULT,
  INVOICE_PAGE_WIDTH_MM,
  INVOICE_BG_OPACITY_MIN,
  INVOICE_BG_OPACITY_MAX,
  INVOICE_BG_OPACITY_DEFAULT,
  clampInvoiceLogoSize,
  clampInvoiceBgSizeMm,
  clampInvoiceBgOpacity,
  invoiceBgOpacityCss,
  invoiceBgWatermarkHeightPct,
} from "@/lib/invoice-assets";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { terbilangRupiah } from "@/lib/terbilang";

/** Harga paket contoh untuk preview (sebelum PPN/diskon). */
const SAMPLE_HARGA_PAKET = 150_000;

const SAMPLE_INVOICE: Omit<
  InvoiceData,
  "settings" | "banks" | "mitraUserId" | "nominal" | "terbilang"
> = {
  pembayaranId: 0,
  isPaid: false,
  noInvoice: "012345",
  barcodeText: "012345",
  tanggalInvoice: "01/05/2026",
  jatuhTempo: "20/05/2026",
  tanggalCetak: "30/05/2026",
  paketNama: "5Mbps",
  periodeAwal: "1 April 2026",
  periodeAkhir: "30 April 2026",
  pelanggan: {
    nama: "BUDI SANTOSO",
    alamat: "Jl. Contoh No. 1, Banyuwangi",
    telp: "081234567890",
    noLayanan: "202605000001",
  },
  caraBayar: null,
  channel: null,
  penerima: null,
};

const sectionClass =
  "rounded-lg shadow-sm border border-slate-200 dark:border-theme-border bg-slate-50/80 dark:bg-theme-card/50 p-4 md:p-5 space-y-3";
const sectionTitleClass =
  "text-sm font-semibold text-slate-800 dark:text-theme-fg pb-2 border-b border-slate-200/80 dark:border-theme-border/80";
const labelClass = "text-sm text-slate-700 dark:text-theme-fg block mb-1";
const hintClass = "text-xs text-slate-500 dark:text-theme-fg-muted";
const fieldClass =
  "mt-1 w-full rounded-lg border border-slate-300 dark:border-theme-border bg-white dark:bg-theme-elevated text-slate-700 dark:text-theme-fg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500/40";
const fileInputClass =
  "mt-1 block w-full text-sm text-slate-600 dark:text-theme-fg-muted file:mr-3 file:rounded-md file:border-0 file:bg-sky-600 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white hover:file:bg-sky-700";

export default function InvoiceSettingsForm() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewPaid, setPreviewPaid] = useState(false);
  const [form, setForm] = useState<InvoiceSettingsDto | null>(null);
  const [banks, setBanks] = useState<InvoiceBankRow[]>([]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [bgFile, setBgFile] = useState<File | null>(null);
  const [bgPreview, setBgPreview] = useState<string | null>(null);

  const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== "string") {
          reject(new Error("Gagal membaca file"));
          return;
        }
        resolve(reader.result);
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/invoice", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat pengaturan");
      setForm(json.data as InvoiceSettingsDto);
      setBanks(Array.isArray(json.banks) ? (json.banks as InvoiceBankRow[]) : []);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const previewData = useMemo((): InvoiceData | null => {
    if (!form) return null;
    const settings: InvoiceSettingsDto = {
      ...form,
      logoUrl: logoPreview ?? form.logoUrl,
      qrUrl: qrPreview ?? form.qrUrl,
      bgUrl: bgPreview ?? form.bgUrl,
    };
    const nominal = computeInvoiceNominal(SAMPLE_HARGA_PAKET, settings);
    const previewBanks = previewPaid ? banks : banksVisibleOnUnpaidInvoice(banks);
    const paidBank = banks[0];
    return {
      ...SAMPLE_INVOICE,
      mitraUserId: 0,
      isPaid: previewPaid,
      settings,
      nominal,
      terbilang: terbilangRupiah(nominal.totalAkhir),
      banks: previewBanks,
      caraBayar: previewPaid && paidBank ? "TRANSFER BANK" : null,
      channel:
        previewPaid && paidBank
          ? `${paidBank.nama} - ${paidBank.norek} - ${paidBank.namaPemilik}`
          : null,
      penerima: previewPaid ? "Admin" : null,
    };
  }, [form, banks, logoPreview, qrPreview, bgPreview, previewPaid]);

  const patch = <K extends keyof InvoiceSettingsDto>(
    key: K,
    value: InvoiceSettingsDto[K]
  ) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const body = new FormData();
      body.set("logoSize", String(form.logoSize));
      body.set("bgWatermark", form.bgWatermark ? "1" : "0");
      body.set("companyName", form.companyName);
      body.set("companySlogan", form.companySlogan);
      body.set("companyAddress1", form.companyAddress1);
      body.set("companyAddress2", form.companyAddress2);
      body.set("companyAddress3", form.companyAddress3);
      body.set("signatureName", form.signatureName);
      body.set("signaturePosition", form.signaturePosition);
      body.set("cashPaymentNote", form.cashPaymentNote);
      body.set("confirmationNumber", form.confirmationNumber);
      body.set("paymentNotes", form.paymentNotes);
      body.set("tandaTerima", form.tandaTerima);
      body.set("ucapanLunas", form.ucapanLunas);
      body.set("footerText", form.footerText);
      body.set("bgSizeMm", String(form.bgSizeMm));
      body.set("bgOpacity", String(form.bgOpacity));
      body.set("ppnStatus", form.ppnStatus ? "1" : "0");
      body.set("ppnValue", String(form.ppnValue));
      body.set("ppnCalculationMode", form.ppnCalculationMode);
      body.set("discountStatus", form.discountStatus ? "1" : "0");
      body.set("discountType", form.discountType);
      body.set("discountValue", String(form.discountValue));
      if (logoFile) body.set("logo", logoFile);
      if (qrFile) body.set("qr", qrFile);
      if (bgFile) body.set("background", bgFile);

      const res = await fetch("/api/settings/invoice", {
        method: "PUT",
        body,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan");
      setForm(json.data as InvoiceSettingsDto);
      setLogoFile(null);
      setQrFile(null);
      setBgFile(null);
      setLogoPreview(null);
      setQrPreview(null);
      setBgPreview(null);
      toast.success(json.message || "Pengaturan disimpan");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form) {
    return (
      <div className="w-full flex justify-center py-16 text-slate-500 dark:text-theme-fg-muted">
        <Loader2 className="animate-spin size-6 mr-2" />
        Memuat pengaturan...
      </div>
    );
  }

  return (
    <div className="space-y-4 w-full">
      <section className="flex flex-col md:grid md:grid-cols-3 gap-3 md:gap-4 w-full items-center">
        <div className="order-2 md:order-none hidden md:block" />
        <p className="flex justify-center font-medium items-center order-1 md:order-none text-slate-800 dark:text-theme-fg">
          Pengaturan Invoice
        </p>
        <div className="order-3 md:order-none flex justify-center md:justify-end gap-2">
          <Button
            type="button"
            color={previewPaid ? "slatesky" : "sky"}
            className="text-xs py-1.5 px-3 xl:hidden"
            onClick={() => setPreviewPaid(false)}
          >
            Belum lunas
          </Button>
          <Button
            type="button"
            color={previewPaid ? "sky" : "slatesky"}
            className="text-xs py-1.5 px-3 xl:hidden"
            onClick={() => setPreviewPaid(true)}
          >
            Lunas
          </Button>
        </div>
      </section>

      <p className="text-sm text-slate-500 dark:text-theme-fg-muted text-center -mt-2 px-2">
        Atur tampilan kuitansi tagihan. Preview di kanan; unduh PDF dari halaman
        pembayaran.
      </p>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 w-full">
        <div className="xl:col-span-5 space-y-4">
          <section className={sectionClass}>
            <h2 className={sectionTitleClass}>Logo &amp; Perusahaan</h2>
            <div>
              <label className={labelClass}>Upload logo (PNG/JPG)</label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className={fileInputClass}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setLogoFile(f);
                  setLogoPreview(await fileToDataUrl(f));
                }}
              />
            </div>
            <div>
              <label className={labelClass}>
                Ukuran logo ({INVOICE_LOGO_SIZE_MIN}–{INVOICE_LOGO_SIZE_MAX} px)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={INVOICE_LOGO_SIZE_MIN}
                  max={INVOICE_LOGO_SIZE_MAX}
                  step={1}
                  value={form.logoSize}
                  className="flex-1"
                  onChange={(e) =>
                    patch("logoSize", clampInvoiceLogoSize(parseInt(e.target.value, 10)))
                  }
                />
                <Input
                  type="number"
                  min={INVOICE_LOGO_SIZE_MIN}
                  max={INVOICE_LOGO_SIZE_MAX}
                  value={String(form.logoSize)}
                  className="w-20 text-center"
                  onChange={(e) =>
                    patch(
                      "logoSize",
                      clampInvoiceLogoSize(parseInt(e.target.value, 10) || INVOICE_LOGO_SIZE_DEFAULT)
                    )
                  }
                />
                <span className={`${hintClass} shrink-0`}>px</span>
              </div>
            </div>
            <div>
              <label className={labelClass}>Nama Perusahaan</label>
              <Input
                value={form.companyName}
                onChange={(e) => patch("companyName", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Slogan</label>
              <Input
                value={form.companySlogan}
                onChange={(e) => patch("companySlogan", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Alamat baris 1</label>
              <Input
                value={form.companyAddress1}
                onChange={(e) => patch("companyAddress1", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Alamat baris 2</label>
              <Input
                value={form.companyAddress2}
                onChange={(e) => patch("companyAddress2", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Alamat baris 3</label>
              <Input
                value={form.companyAddress3}
                onChange={(e) => patch("companyAddress3", e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-theme-fg">
              <input
                type="checkbox"
                checked={form.bgWatermark}
                onChange={(e) => patch("bgWatermark", e.target.checked)}
              />
              Tampilkan watermark background
            </label>
            {form.bgWatermark && (
              <>
                <div>
                  <label className={labelClass}>Ukuran watermark (lebar gambar)</label>
                  <p className={`${hintClass} mb-2`}>
                    Lebar dalam mm — default {INVOICE_BG_SIZE_MM_DEFAULT} mm (kertas A4{" "}
                    {INVOICE_PAGE_WIDTH_MM} mm).
                  </p>
                  <div className={`flex items-center gap-2 ${hintClass} mb-1`}>
                    <span>Kecil</span>
                    <span className="flex-1" />
                    <span>Besar</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={INVOICE_BG_SIZE_MM_MIN}
                      max={INVOICE_BG_SIZE_MM_MAX}
                      step={1}
                      value={form.bgSizeMm}
                      className="flex-1"
                      onChange={(e) =>
                        patch(
                          "bgSizeMm",
                          clampInvoiceBgSizeMm(parseInt(e.target.value, 10))
                        )
                      }
                    />
                    <Input
                      type="number"
                      min={INVOICE_BG_SIZE_MM_MIN}
                      max={INVOICE_BG_SIZE_MM_MAX}
                      value={String(form.bgSizeMm)}
                      className="w-16 text-center"
                      onChange={(e) =>
                        patch(
                          "bgSizeMm",
                          clampInvoiceBgSizeMm(
                            parseInt(e.target.value, 10) ||
                              INVOICE_BG_SIZE_MM_DEFAULT
                          )
                        )
                      }
                    />
                    <span className={`${hintClass} shrink-0`}>mm</span>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>
                    Ketebalan watermark (tebal ↔ tipis)
                  </label>
                  <div className={`flex items-center gap-2 ${hintClass} mb-1`}>
                    <span>Tipis</span>
                    <span className="flex-1" />
                    <span>Tebal</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={INVOICE_BG_OPACITY_MIN}
                      max={INVOICE_BG_OPACITY_MAX}
                      step={1}
                      value={form.bgOpacity}
                      className="flex-1"
                      onChange={(e) =>
                        patch(
                          "bgOpacity",
                          clampInvoiceBgOpacity(parseInt(e.target.value, 10))
                        )
                      }
                    />
                    <Input
                      type="number"
                      min={INVOICE_BG_OPACITY_MIN}
                      max={INVOICE_BG_OPACITY_MAX}
                      value={String(form.bgOpacity)}
                      className="w-16 text-center"
                      onChange={(e) =>
                        patch(
                          "bgOpacity",
                          clampInvoiceBgOpacity(
                            parseInt(e.target.value, 10) ||
                              INVOICE_BG_OPACITY_DEFAULT
                          )
                        )
                      }
                    />
                    <span className={`${hintClass} shrink-0`}>%</span>
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 dark:border-theme-border bg-white dark:bg-theme-elevated overflow-hidden p-2">
                  <div
                    className="relative mx-auto overflow-hidden"
                    style={{ width: "100%", maxWidth: "100%", height: "96px" }}
                  >
                    <div
                      className="absolute top-0 left-1/2 -translate-x-1/2 bg-no-repeat"
                      style={{
                        width: `${Math.min(100, Math.round((form.bgSizeMm / INVOICE_PAGE_WIDTH_MM) * 100))}%`,
                        height: `${invoiceBgWatermarkHeightPct(form.bgSizeMm)}%`,
                        backgroundImage: `url(${bgPreview ?? form.bgUrl})`,
                        backgroundSize: "100% auto",
                        backgroundPosition: "top center",
                        opacity: invoiceBgOpacityCss(form.bgOpacity),
                      }}
                    />
                  </div>
                  <p className={`${hintClass} mt-2 text-center`}>
                    Preview lebar {form.bgSizeMm}mm — kertas {INVOICE_PAGE_WIDTH_MM}
                    mm
                  </p>
                </div>
              </>
            )}
            <div>
              <label className={labelClass}>
                Background/watermark (JPG/PNG max 100KB)
              </label>
              <input
                type="file"
                accept="image/png,image/jpeg"
                className={fileInputClass}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  if (f.size > 100 * 1024) {
                    toast.error("Background maksimal 100KB");
                    e.target.value = "";
                    return;
                  }
                  setBgFile(f);
                  setBgPreview(await fileToDataUrl(f));
                }}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={bgPreview ?? form.bgUrl}
                alt="Background preview"
                className="mt-2 w-full max-h-32 object-contain border border-slate-200 dark:border-theme-border rounded-lg bg-white dark:bg-theme-bg"
              />
            </div>
          </section>

          <section className={sectionClass}>
            <h2 className={sectionTitleClass}>Tanda Tangan &amp; QR</h2>
            <div>
              <label className={labelClass}>Upload QR (PNG/JPG)</label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className={fileInputClass}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setQrFile(f);
                  setQrPreview(await fileToDataUrl(f));
                }}
              />
            </div>
            <div>
              <label className={labelClass}>Nama penanggung jawab</label>
              <Input
                value={form.signatureName}
                onChange={(e) => patch("signatureName", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Jabatan</label>
              <Input
                value={form.signaturePosition}
                onChange={(e) => patch("signaturePosition", e.target.value)}
              />
            </div>
          </section>

          <section className={sectionClass}>
            <h2 className={sectionTitleClass}>PPN &amp; Diskon</h2>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-theme-fg">
              <input
                type="checkbox"
                checked={form.ppnStatus}
                onChange={(e) => patch("ppnStatus", e.target.checked)}
              />
              Aktifkan PPN
            </label>
            <div>
              <label className={labelClass}>Nilai PPN (%)</label>
              <Input
                type="number"
                value={String(form.ppnValue)}
                onChange={(e) => patch("ppnValue", parseFloat(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className={labelClass}>Mode perhitungan PPN</label>
              <select
                className={fieldClass}
                value={form.ppnCalculationMode}
                onChange={(e) =>
                  patch(
                    "ppnCalculationMode",
                    e.target.value === "before" ? "before" : "after"
                  )
                }
              >
                <option value="after">PPN ditambahkan (after)</option>
                <option value="before">Harga sudah termasuk PPN (before)</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-theme-fg">
              <input
                type="checkbox"
                checked={form.discountStatus}
                onChange={(e) => patch("discountStatus", e.target.checked)}
              />
              Aktifkan diskon
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={labelClass}>Tipe diskon</label>
                <select
                  className={fieldClass}
                  value={form.discountType}
                  onChange={(e) =>
                    patch(
                      "discountType",
                      e.target.value === "percentage" ? "percentage" : "fixed"
                    )
                  }
                >
                  <option value="fixed">Nominal</option>
                  <option value="percentage">Persen</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Nilai diskon</label>
                <Input
                  type="number"
                  value={String(form.discountValue)}
                  onChange={(e) =>
                    patch("discountValue", parseFloat(e.target.value) || 0)
                  }
                />
              </div>
            </div>
          </section>

          <section className={sectionClass}>
            <h2 className={sectionTitleClass}>Teks Invoice</h2>
            <div>
              <label className={labelClass}>Cara pembayaran tunai</label>
              <Input
                value={form.cashPaymentNote}
                onChange={(e) => patch("cashPaymentNote", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Nomor konfirmasi</label>
              <Input
                value={form.confirmationNumber}
                onChange={(e) => patch("confirmationNumber", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Catatan (satu baris per poin)</label>
              <textarea
                className={`${fieldClass} min-h-[80px] resize-y`}
                value={form.paymentNotes}
                onChange={(e) => patch("paymentNotes", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Tanda terima lunas</label>
              <Input
                value={form.tandaTerima}
                onChange={(e) => patch("tandaTerima", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Ucapan setelah lunas</label>
              <textarea
                className={`${fieldClass} min-h-[80px] resize-y`}
                value={form.ucapanLunas}
                onChange={(e) => patch("ucapanLunas", e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Footer</label>
              <Input
                value={form.footerText}
                onChange={(e) => patch("footerText", e.target.value)}
              />
            </div>
          </section>

          <Button
            type="button"
            color="sky"
            className="w-full sm:w-auto"
            loading={saving}
            loadingMessage="Menyimpan..."
            onClick={() => void save()}
          >
            Simpan Pengaturan
          </Button>
        </div>

        <div className="xl:col-span-7">
          <div className="xl:sticky xl:top-4 space-y-3">
            <div className="hidden xl:flex gap-2">
              <Button
                type="button"
                color={previewPaid ? "slatesky" : "sky"}
                className="text-sm"
                onClick={() => setPreviewPaid(false)}
              >
                Preview Belum Lunas
              </Button>
              <Button
                type="button"
                color={previewPaid ? "sky" : "slatesky"}
                className="text-sm"
                onClick={() => setPreviewPaid(true)}
              >
                Preview Lunas
              </Button>
            </div>
            <div className="rounded-lg shadow-sm border border-slate-200 dark:border-theme-border bg-slate-100 dark:bg-theme-elevated/40 p-3 max-h-[calc(100vh-8rem)] overflow-y-auto overflow-x-hidden">
              {previewData ? (
                <InvoiceTemplate data={previewData} />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
