import { z } from "zod";

/** Kosong/whitespace → null (inline — tanpa lib/pelanggan-email agar hotfix VPS mandiri). */
function normalizeEmail(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Body POST /api/router/ppp/pelanggan — hanya field dari form PPP.
 * Jangan pakai PelangganOptionalDefaultsSchema penuh (gampang gagal jika
 * schema DB/Zod berubah: noLayanan, lifecycle, isFreeCustomer, dll.).
 */
export const PelangganPppCreateBodySchema = z.object({
  routerId: z.number().int(),
  paketId: z.number().int(),
  ppp_secretId: z.number().int().nullish(),
  nama: z.string().min(1),
  nik: z.string().max(20).nullish(),
  alamat: z.string().optional().default(""),
  nomor: z.string().min(1),
  email: z.string().nullish(),
  foto: z.string().nullish(),
  lat: z.string().nullish(),
  lng: z.string().nullish(),
  tgl: z.string().min(1),
  tgl_isolir: z.number().int().min(1).max(30).nullish(),
  stop: z.boolean().optional(),
});

export type PelangganPppCreateBody = z.infer<typeof PelangganPppCreateBodySchema>;

/** DB lama (VPS): email kolom String wajib — null → "". DB baru nullable tetap aman. */
export function pelangganEmailForPrisma(value: string | null): string {
  return value ?? "";
}

/** Kosong/whitespace → null. */
export function normalizeNik(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function toPelangganPppWriteData(
  data: PelangganPppCreateBody & { email: string | null }
) {
  return {
    routerId: data.routerId,
    paketId: data.paketId,
    ppp_secretId: data.ppp_secretId ?? undefined,
    nama: data.nama,
    nik: normalizeNik(data.nik),
    alamat: data.alamat,
    nomor: data.nomor,
    email: pelangganEmailForPrisma(data.email),
    foto: data.foto ?? undefined,
    lat: data.lat ?? undefined,
    lng: data.lng ?? undefined,
    tgl: data.tgl,
    tgl_isolir: data.tgl_isolir ?? undefined,
    stop: data.stop ?? false,
  };
}

export function parsePelangganPppCreateBody(raw: unknown):
  | { ok: true; data: PelangganPppCreateBody & { email: string | null } }
  | { ok: false; error: z.ZodError } {
  const parsed = PelangganPppCreateBodySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error };
  }

  return {
    ok: true,
    data: {
      ...parsed.data,
      alamat: parsed.data.alamat ?? "",
      nik: normalizeNik(parsed.data.nik),
      email: normalizeEmail(parsed.data.email),
    },
  };
}
