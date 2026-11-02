import { getPelangganInScope } from "@/lib/authz";
import {
  DEFAULT_BILLING_GENERATE_DAY,
  resolveMitraGenerateDay,
} from "@/lib/billing-generate-config";
import { BILLING } from "@/lib/constants";
import { resolveNoInvoice } from "@/lib/pembayaran-no-invoice";
import { resolveNoLayanan } from "@/lib/pelanggan-no-layanan";
import { parseJatuhTempoParts } from "@/lib/pembayaran-tax";
import {
  getInvoiceSettingsForUser,
  type InvoiceSettingsDto,
} from "@/lib/invoice-settings";
import { nominalPaketForDisplay } from "@/lib/paket-persist";
import prisma from "@/lib/prisma";
import { banksVisibleOnUnpaidInvoice } from "@/lib/invoice-banks";
import { terbilangRupiah } from "@/lib/terbilang";
import type { User } from "lucia";

export type InvoiceBankRow = {
  nama: string;
  norek: string;
  namaPemilik: string;
  hideFromUnpaidInvoice?: boolean;
};

export type InvoiceData = {
  pembayaranId: number;
  mitraUserId: number;
  isPaid: boolean;
  noInvoice: string;
  barcodeText: string;
  tanggalInvoice: string;
  jatuhTempo: string;
  tanggalCetak: string;
  paketNama: string;
  periodeAwal: string;
  periodeAkhir: string;
  pelanggan: {
    nama: string;
    alamat: string;
    telp: string;
    noLayanan: string;
  };
  nominal: {
    hargaPaket: number;
    ppn: number;
    potongan: number;
    totalAkhir: number;
  };
  terbilang: string;
  caraBayar: string | null;
  channel: string | null;
  penerima: string | null;
  banks: InvoiceBankRow[];
  settings: InvoiceSettingsDto;
};

function formatDmY(d: Date) {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function clampDayInMonth(year: number, month: number, day: number): Date {
  const last = new Date(year, month, 0).getDate();
  const safe = Math.min(Math.max(1, Math.trunc(day)), last);
  return new Date(year, month - 1, safe);
}

/** Nama paket di invoice. Awalan PAKET tidak diulang bila nama sudah memuat kata itu. */
export function formatInvoicePaketLabel(nama: string | null | undefined): string {
  const text = (nama ?? "").trim().replace(/\s+/g, " ");
  if (!text) return "PAKET -";
  const once = text.replace(/^(paket)(?:\s+paket)+\b/i, "$1");
  if (/\bpaket\b/i.test(once)) return once;
  return `PAKET ${once}`;
}

/** Tanggal isolir pelanggan. Kosong memakai tanggal 20. */
export function invoiceIsolirDueDay(tglIsolir: number | null | undefined): number {
  if (tglIsolir == null || !Number.isInteger(tglIsolir) || tglIsolir < 1) {
    return BILLING.DUE_DAY_OF_MONTH;
  }
  return tglIsolir;
}

const NAMA_BULAN = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

function formatTanggalIndonesia(d: Date) {
  return `${d.getDate()} ${NAMA_BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

/** Periode layanan di invoice: satu bulan kalender sebelum bulan jatuh tempo. */
export function periodePaketFromJatuhTempo(jatuh_tempo: string) {
  const { year, month } = parseJatuhTempoParts(jatuh_tempo);
  const awal = new Date(year, month - 2, 1);
  const akhir = new Date(year, month - 1, 0);
  return {
    awal: formatTanggalIndonesia(awal),
    akhir: formatTanggalIndonesia(akhir),
  };
}

export function computeInvoiceNominal(
  hargaPaketAsli: number,
  settings: InvoiceSettingsDto,
  actualTotal?: number
) {
  let hargaPaket = hargaPaketAsli;
  let ppn = 0;
  let potongan = 0;
  let totalAkhir = hargaPaketAsli;

  if (settings.ppnStatus) {
    const ppnPct = settings.ppnValue;
    if (settings.ppnCalculationMode === "before") {
      hargaPaket = (hargaPaketAsli * 100) / (100 + ppnPct);
      ppn = hargaPaketAsli - hargaPaket;
      totalAkhir = hargaPaketAsli;
    } else {
      ppn = (hargaPaketAsli * ppnPct) / 100;
      totalAkhir = hargaPaketAsli + ppn;
    }
  }

  if (settings.discountStatus) {
    if (settings.discountType === "percentage") {
      potongan = (hargaPaketAsli * settings.discountValue) / 100;
    } else {
      potongan = settings.discountValue;
    }
    totalAkhir -= potongan;
  }

  // Saat PPN aktif, kunci total ke Pembayaran.total agar cetak = nominal tertagih.
  // Saat PPN nonaktif, jangan override: tampilkan harga paket penuh (± diskon).
  if (settings.ppnStatus && actualTotal != null && actualTotal > 0) {
    totalAkhir = Math.round(actualTotal);
    potongan = Math.round(potongan);
    if (settings.ppnCalculationMode === "before") {
      // hargaPaketAsli = bruto; pecah ulang dari total tertagih.
      hargaPaket = Math.round(
        (totalAkhir * 100) / (100 + settings.ppnValue)
      );
      ppn = totalAkhir - hargaPaket;
    } else {
      // hargaPaketAsli = DPP.
      hargaPaket = Math.round(hargaPaketAsli);
      ppn = totalAkhir - hargaPaket;
    }
    return {
      hargaPaket,
      ppn: Math.max(0, ppn),
      potongan,
      totalAkhir,
    };
  }

  return {
    hargaPaket: Math.round(hargaPaket),
    ppn: Math.round(ppn),
    potongan: Math.round(potongan),
    totalAkhir: Math.round(totalAkhir),
  };
}

export async function getInvoiceData(
  pembayaranId: number,
  actor: User
): Promise<InvoiceData | null> {
  const pembayaran = await prisma.pembayaran.findUnique({
    where: { id: pembayaranId },
    include: {
      paket: true,
      bank: true,
      pelanggan: {
        include: {
          ppp_secret: { select: { name: true } },
          router: { select: { userId: true } },
        },
      },
      log: {
        where: { status: "Terbayar" },
        orderBy: { created: "desc" },
        take: 1,
        include: { user: { select: { nama: true } } },
      },
    },
  });

  if (!pembayaran?.pelanggan) return null;

  const inScope = await getPelangganInScope(pembayaran.pelangganId, actor);
  if (!inScope) return null;

  const mitraUserId = pembayaran.pelanggan.router.userId;
  if (mitraUserId == null && actor.role !== "Superadmin") return null;

  const ownerId = mitraUserId ?? actor.id;
  const settings = await getInvoiceSettingsForUser(ownerId);
  const isPaid = pembayaran.status === "Terbayar";
  const hargaDpp = Math.round(Number(pembayaran.paket.harga));
  const hargaNominal = nominalPaketForDisplay(
    {
      harga: hargaDpp,
      nominalPembayaran: pembayaran.paket.nominalPembayaran,
    },
    settings.ppnValue
  );
  // PPN mati / mode "before": tampilkan harga paket penuh (nominal), bukan DPP.
  // PPN "after": basis hitung = DPP, lalu ditambah PPN (atau dikunci ke Pembayaran.total).
  const hargaPaketAsli =
    !settings.ppnStatus || settings.ppnCalculationMode === "before"
      ? hargaNominal
      : hargaDpp;
  const nominal = computeInvoiceNominal(
    hargaPaketAsli,
    settings,
    settings.ppnStatus ? Number(pembayaran.total) : undefined
  );

  const periode = periodePaketFromJatuhTempo(pembayaran.jatuh_tempo);
  const { year, month } = parseJatuhTempoParts(pembayaran.jatuh_tempo);
  const [appSettings, mitra] = await Promise.all([
    prisma.appSettings.findUnique({
      where: { id: 1 },
      select: { billingGenerateDay: true },
    }),
    prisma.user.findUnique({
      where: { id: ownerId },
      select: { billingGenerateDay: true },
    }),
  ]);
  const generateDay = resolveMitraGenerateDay(
    mitra?.billingGenerateDay,
    appSettings?.billingGenerateDay ?? DEFAULT_BILLING_GENERATE_DAY
  );
  const noInvoice = resolveNoInvoice(pembayaran);

  const banksRaw = await prisma.bank.findMany({
    where: { userId: ownerId, deleted: false },
    orderBy: { id: "asc" },
  });
  const banksForInvoice = isPaid ? banksRaw : banksVisibleOnUnpaidInvoice(banksRaw);
  const banks: InvoiceBankRow[] = banksForInvoice.map((b) => ({
    nama: b.bank,
    norek: b.norek,
    namaPemilik: b.nama,
    hideFromUnpaidInvoice: b.hideFromUnpaidInvoice,
  }));

  let caraBayar: string | null = null;
  let channel: string | null = null;
  let penerima: string | null = null;

  if (isPaid) {
    const bankLabel = pembayaran.bank?.bank ?? "";
    caraBayar =
      pembayaran.metode === "Cash" ||
      bankLabel.toLowerCase().includes("tunai")
        ? "TUNAI"
        : "TRANSFER BANK";

    if (caraBayar === "TRANSFER BANK" && pembayaran.bank) {
      channel = `${pembayaran.bank.bank} - ${pembayaran.bank.norek} - ${pembayaran.bank.nama}`;
    } else if (pembayaran.bank) {
      channel = pembayaran.bank.bank;
    } else {
      channel = caraBayar;
    }

    penerima =
      pembayaran.log[0]?.user?.nama || actor.nama || "Penerima";
  }

  return {
    pembayaranId: pembayaran.id,
    mitraUserId: ownerId,
    isPaid,
    noInvoice,
    barcodeText: noInvoice,
    tanggalInvoice: formatDmY(clampDayInMonth(year, month, generateDay)),
    jatuhTempo: formatDmY(
      clampDayInMonth(
        year,
        month,
        invoiceIsolirDueDay(pembayaran.pelanggan.tgl_isolir)
      )
    ),
    tanggalCetak: formatDmY(new Date()),
    paketNama: pembayaran.paket.nama?.trim() || "-",
    periodeAwal: periode.awal,
    periodeAkhir: periode.akhir,
    pelanggan: {
      nama: pembayaran.pelanggan.nama || "-",
      alamat: pembayaran.pelanggan.alamat || "-",
      telp: pembayaran.pelanggan.nomor || "-",
      noLayanan: resolveNoLayanan(pembayaran.pelanggan),
    },
    nominal,
    terbilang: terbilangRupiah(nominal.totalAkhir),
    caraBayar,
    channel,
    penerima,
    banks,
    settings,
  };
}

export function pembayaranInvoiceHref(pembayaranId: number) {
  return `/pembayaran/invoice/${pembayaranId}`;
}

/** Unduh PDF langsung seperti apiwin paid.php / unpaid.php */
export function pembayaranInvoicePdfHref(pembayaranId: number) {
  return `/api/pembayaran/invoice/${pembayaranId}/pdf`;
}
