import { getPelangganInScope } from "@/lib/authz";
import { resolveNoInvoice } from "@/lib/pembayaran-no-invoice";
import { resolveNoLayanan } from "@/lib/pelanggan-no-layanan";
import { billingPeriodFromJatuhTempo } from "@/lib/billing-due-date";
import prisma from "@/lib/prisma";
import {
  ppnNominalPerBaris,
  parseJatuhTempoParts,
} from "@/lib/pembayaran-tax";
import { formatJatuhTempoId } from "@/lib/pembayaran-cetak";
import { tagihanServiceDescription } from "@/lib/pembayaran-petugas-response";
import type { User } from "lucia";

export type PembayaranKuitansiData = {
  pembayaranId: number;
  isPaid: boolean;
  invoiceNo: string;
  periodeLabel: string;
  periodeCode: string;
  tanggalInvoice: string;
  tanggalCetak: string;
  jatuhTempoLabel: string;
  tanggalBayarLabel: string | null;
  statusLabel: string;
  pelanggan: {
    nama: string;
    alamat: string;
    nomor: string;
    noLayanan: string;
  };
  paket: {
    nama: string;
    deskripsi: string;
  };
  nominal: {
    dpp: number;
    ppn: number;
    potongan: number;
    total: number;
  };
  metodeLabel: string | null;
  channelLabel: string | null;
  mitra: {
    nama: string;
    alamat: string | null;
    nomor: string | null;
    website: string;
  };
  penerima: string;
};

function formatTanggalId(d: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

function periodeLabelFromJatuhTempo(jatuh_tempo: string) {
  const { year, month } = parseJatuhTempoParts(jatuh_tempo);
  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

export async function getPembayaranKuitansiData(
  pembayaranId: number,
  actor: User
): Promise<PembayaranKuitansiData | null> {
  const pembayaran = await prisma.pembayaran.findUnique({
    where: { id: pembayaranId },
    include: {
      paket: true,
      bank: true,
      pelanggan: {
        include: {
          ppp_secret: { select: { name: true } },
          router: { select: { userId: true, nama: true } },
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

  const mitra = mitraUserId
    ? await prisma.user.findUnique({
        where: { id: mitraUserId },
        select: { nama: true, alamat: true, nomor: true, ppn: true, user: true },
      })
    : null;

  const ppnPercent = mitra?.ppn ?? 11;
  const dpp = Math.round(Number(pembayaran.paket.harga));
  const total = Math.round(Number(pembayaran.total));
  const ppn = ppnNominalPerBaris(total, dpp, ppnPercent);
  const potongan = 0;

  const paidLog = pembayaran.log[0] ?? null;
  const isPaid = pembayaran.status === "Terbayar";
  const periodeCode = billingPeriodFromJatuhTempo(pembayaran.jatuh_tempo);

  let channelLabel: string | null = null;
  if (isPaid) {
    if (pembayaran.metode === "Cash" || pembayaran.bank?.bank?.toLowerCase() === "tunai") {
      channelLabel = "TUNAI";
    } else if (pembayaran.bank) {
      channelLabel = `${pembayaran.bank.bank} - ${pembayaran.bank.norek} - ${pembayaran.bank.nama}`;
    } else {
      channelLabel = pembayaran.metode === "Transfer" ? "TRANSFER BANK" : null;
    }
  } else if (mitraUserId) {
    const bank = await prisma.bank.findFirst({
      where: { userId: mitraUserId, deleted: false, hideFromUnpaidInvoice: false },
      orderBy: { id: "asc" },
    });
    if (bank) {
      channelLabel = `${bank.bank} - ${bank.norek} - ${bank.nama}`;
    }
  }

  const noLayanan = resolveNoLayanan(pembayaran.pelanggan);
  const noInvoice = resolveNoInvoice(pembayaran);
  const pppName = pembayaran.pelanggan.ppp_secret?.name ?? "-";
  const routerName = pembayaran.pelanggan.router.nama;

  return {
    pembayaranId: pembayaran.id,
    isPaid,
    invoiceNo: `INV ${noInvoice}`,
    periodeLabel: periodeLabelFromJatuhTempo(pembayaran.jatuh_tempo),
    periodeCode,
    tanggalInvoice: formatTanggalId(pembayaran.created),
    tanggalCetak: formatTanggalId(new Date()),
    jatuhTempoLabel: formatJatuhTempoId(pembayaran.jatuh_tempo),
    tanggalBayarLabel: paidLog ? formatTanggalId(paidLog.created) : null,
    statusLabel: isPaid ? "LUNAS" : "Belum Bayar",
    pelanggan: {
      nama: pembayaran.pelanggan.nama,
      alamat: pembayaran.pelanggan.alamat || "-",
      nomor: pembayaran.pelanggan.nomor || "-",
      noLayanan,
    },
    paket: {
      nama: pembayaran.paket.nama,
      deskripsi: tagihanServiceDescription(
        actor.role,
        routerName,
        pppName,
        periodeLabelFromJatuhTempo(pembayaran.jatuh_tempo)
      ),
    },
    nominal: {
      dpp,
      ppn,
      potongan,
      total,
    },
    metodeLabel: isPaid
      ? pembayaran.metode === "Cash"
        ? "TUNAI"
        : "TRANSFER BANK"
      : null,
    channelLabel,
    mitra: {
      nama: mitra?.nama || actor.nama || "Router Monitor",
      alamat: mitra?.alamat ?? null,
      nomor: mitra?.nomor ?? null,
      website: mitra?.user ? `${mitra.user}@router-monitor` : "",
    },
    penerima: paidLog?.user?.nama || actor.nama,
  };
}

/** @deprecated use pembayaranInvoiceHref from lib/invoice-data */
export function pembayaranKuitansiHref(pembayaranId: number) {
  return `/pembayaran/invoice/${pembayaranId}`;
}
