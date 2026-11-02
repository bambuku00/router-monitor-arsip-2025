import { z } from "zod";

/** Allow-list field yang boleh di-PUT untuk pelanggan PPP (cegah mass assignment). */
export const PelangganUpdateSchema = z
  .object({
    nama: z.string().min(1).optional(),
    nik: z.string().max(20).nullable().optional(),
    alamat: z.string().nullable().optional(),
    nomor: z.string().min(1).optional(),
    email: z.string().nullable().optional(),
    foto: z.string().nullable().optional(),
    lat: z.string().nullable().optional(),
    lng: z.string().nullable().optional(),
    tgl: z.string().min(1).optional(),
    stop: z.boolean().optional(),
    tgl_stop: z.string().nullable().optional(),
    tgl_isolir: z.number().int().min(1).max(30).nullable().optional(),
    paketId: z.number().int().optional(),
  })
  .superRefine((data, ctx) => {
    const isStatusOnly =
      data.stop !== undefined &&
      data.nama === undefined &&
      data.nomor === undefined &&
      data.tgl === undefined &&
      data.paketId === undefined &&
      data.alamat === undefined &&
      data.email === undefined;

    if (isStatusOnly) return;

    const missing: string[] = [];
    if (!data.nama) missing.push("nama");
    if (data.alamat === undefined) missing.push("alamat");
    if (!data.nomor) missing.push("nomor");
    if (data.email === undefined) missing.push("email");
    if (!data.tgl) missing.push("tgl");
    if (data.paketId === undefined) missing.push("paketId");

    if (missing.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Data is not valid",
      });
    }
  });

export type PelangganUpdateInput = z.infer<typeof PelangganUpdateSchema>;

/** Body PUT pelanggan PPP dari form edit — hanya field yang diizinkan API. */
function normalizeNik(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

export function pelangganUpdateBodyFromForm(data: {
  nama?: string | null;
  nik?: string | null;
  alamat?: string | null;
  nomor?: string | null;
  email?: string | null;
  tgl?: string | null;
  paketId?: number | null;
  lat?: string | null;
  lng?: string | null;
  tgl_isolir?: number | null;
  stop?: boolean | null;
}): PelangganUpdateInput {
  return {
    nama: data.nama ?? undefined,
    nik: normalizeNik(data.nik),
    alamat: data.alamat ?? null,
    nomor: data.nomor ?? undefined,
    email: data.email ?? null,
    tgl: data.tgl ?? undefined,
    paketId: data.paketId ?? undefined,
    lat: data.lat ?? null,
    lng: data.lng ?? null,
    tgl_isolir: data.tgl_isolir ?? null,
    stop: data.stop ?? undefined,
  };
}
