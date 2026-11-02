import {
  PembayaranOptionalDefaultsSchema,
  PembayaranMitraOptionalDefaultsSchema,
  UserSchema,
} from "@/prisma/generated/zod";
import { z } from "zod";

export const PembayaranPelangganSchema = PembayaranOptionalDefaultsSchema.pick({
  status: true,
  metode: true,
  total: true,
  bankId: true,
}).extend({
  /** 1 = bulan tagihan ini. 2–6 = bulan ini plus bulan berikutnya, sekaligus lunas. */
  bulanBayar: z.coerce.number().int().min(1).max(6).optional(),
});

export type PembayaranPelanggan = z.infer<typeof PembayaranPelangganSchema>;

export const PembayaranMitraSchema = PembayaranMitraOptionalDefaultsSchema.pick(
  {
    id: true,
    userId: true,
    status: true,
    paid: true,
    tanggal: true,
    total: true,
    metode: true,
    bankId: true,
  }
).merge(UserSchema.pick({ password: true }));

export type PembayaranMitra = z.infer<typeof PembayaranMitraSchema>;

type PembayaranStatusRow = {
  status: string;
  metode?: "Transfer" | "Cash" | null;
  bank?: { bank?: string | null } | null;
};

/** Label sel bulan di halaman pembayaran (mis. Terbayar Cash / Terbayar Transfer). */
export function formatPembayaranStatusCellLabel(
  pemb: PembayaranStatusRow
): string {
  if (pemb.status === "Terbayar") {
    if (pemb.metode === "Cash") return "Terbayar Cash";
    if (pemb.metode === "Transfer") return "Terbayar Transfer";
    return "Terbayar";
  }
  return pemb.status;
}

/** Keterangan tagihan yang dilunasi beberapa bulan sekaligus. */
export function pembayaranBayarSekaligusLabel(
  bayarSekaligus: number | null | undefined
): string | null {
  if (bayarSekaligus == null || bayarSekaligus <= 1) return null;
  return `Bayar ${bayarSekaligus} bulan`;
}

/** Nama bank di bawah status Terbayar Transfer (mis. BCA, BRI). */
export function pembayaranTransferBankName(
  pemb: PembayaranStatusRow
): string | null {
  if (pemb.status !== "Terbayar" || pemb.metode !== "Transfer") return null;
  const name = pemb.bank?.bank?.trim();
  return name ? name : null;
}
