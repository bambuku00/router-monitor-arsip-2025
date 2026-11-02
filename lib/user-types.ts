import {
  ClientOptionalDefaultsSchema,
  ClientPeroranganOptionalDefaultsSchema,
  UserOptionalDefaultsSchema,
  ClientPeroranganSchema,
} from "@/prisma/generated/zod";
import { StaffMenuKeySchema } from "@/lib/staff-menu-keys";
import { validateMitraOmsetPercent } from "@/lib/revenue-basis";
import { Identitas } from "@prisma/client";
import { z } from "zod";

function toOptionalId(value: unknown): number | undefined {
  if (value === "" || value == null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function toNullableNumber(value: unknown): number | null {
  if (value === "" || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Peran yang boleh dipilih saat membuat akun dari form pengguna. */
const formRoleValues = [
  "Superadmin",
  "Admin",
  "Keuangan",
  "Teknisi",
  "Client",
  "Pending",
] as const;

/** Edit boleh memuat akun Petugas yang sudah ada. Membuat akun Petugas tetap ditolak. */
const editRoleValues = [...formRoleValues, "Petugas"] as const;

type EditableUserRole = (typeof editRoleValues)[number];

const UserBaseSchema = UserOptionalDefaultsSchema.omit({
  role: true,
  staffMenuKeys: true,
  password: true,
  omset: true,
  ppn: true,
  id: true,
}).merge(
  z.object({
    id: z.preprocess(toOptionalId, z.number().int().optional()),
    password: z
      .string()
      .min(8, { message: "Minimal 8 karakter" }),
    user: z
      .string()
      .min(1, { message: "Required" })
      .regex(/^[a-z0-9_-]+$/, {
        message: "Hanya huruf kecil, angka, _, -",
      }),
    omset: z.preprocess(
      toNullableNumber,
      z.number().int().min(0).max(100).nullish()
    ),
    ppn: z.preprocess(
      toNullableNumber,
      z.number().min(0).max(100).nullish()
    ),
    role: z.enum(formRoleValues, {
      invalid_type_error: "Required",
      message: "Required",
    }),
    staffMenuKeys: z.array(StaffMenuKeySchema).nullable().optional(),
    staffPelangganScope: z.array(z.number().int()).nullable().optional(),
    staffAllowBankPayment: z.boolean().optional(),
    staffAllowIsolir: z.boolean().optional(),
    staffAllowCancelPayment: z.boolean().optional(),
    staffAllowBerhenti: z.boolean().optional(),
    revenueBasis: z.enum(["INVOICE", "PAID"]).optional(),
    billingStartMode: z
      .enum(["NEXT_MONTH", "IMMEDIATE", "CUSTOM_DATE"])
      .optional(),
    billingGenerateDay: z.number().int().min(1).max(28).nullable().optional(),
    freeCustomerQuotaMode: z.enum(["unlimited", "limited"]).optional(),
    freeCustomerLimit: z.preprocess(
      toNullableNumber,
      z.number().int().min(0).nullable().optional()
    ),
    pppPackageChangeQuotaMode: z.enum(["unlimited", "limited"]).optional(),
    pppPackageChangeLimit: z.preprocess(
      toNullableNumber,
      z.number().int().min(0).nullable().optional()
    ),
    pppAutoFillEnabled: z.boolean().optional(),
    portalPelangganEnabled: z.boolean().optional(),
    portalSlug: z.string().max(32).nullable().optional(),
    ownedByIsp: z.boolean().optional(),
    revenueShareEnabled: z.boolean().optional(),
    ppnEnabled: z.boolean().optional(),
    billingYear2025Only: z.boolean().optional(),
  })
);

type StaffMenuWhitelistRefineInput = {
  role: EditableUserRole;
  staffMenuKeys?: z.infer<typeof UserBaseSchema>["staffMenuKeys"];
  staffPelangganScope?: z.infer<typeof UserBaseSchema>["staffPelangganScope"];
};

function refineStaffMenuWhitelist(
  data: StaffMenuWhitelistRefineInput,
  ctx: z.RefinementCtx
) {
  if (
    (data.role === "Teknisi" || data.role === "Keuangan") &&
    Array.isArray(data.staffMenuKeys) &&
    data.staffMenuKeys.length === 0
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "Daftar menu kosong: nonaktifkan pembatasan untuk akses penuh, atau pilih minimal satu menu.",
      path: ["staffMenuKeys"],
    });
  }
  if (
    (data.role === "Teknisi" || data.role === "Keuangan") &&
    Array.isArray(data.staffPelangganScope) &&
    data.staffPelangganScope.length === 0
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "Daftar pelanggan kosong: nonaktifkan pembatasan PPP, atau pilih minimal satu pelanggan.",
      path: ["staffPelangganScope"],
    });
  }
}

function refineFreeCustomerQuota(
  data: Pick<
    z.infer<typeof UserBaseSchema>,
    | "freeCustomerQuotaMode"
    | "freeCustomerLimit"
    | "pppPackageChangeQuotaMode"
    | "pppPackageChangeLimit"
  > & { role: EditableUserRole },
  ctx: z.RefinementCtx
) {
  if (data.role !== "Admin") return;
  if (data.freeCustomerQuotaMode === "limited") {
    if (
      data.freeCustomerLimit == null ||
      !Number.isFinite(data.freeCustomerLimit)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Masukkan maksimal pelanggan gratis (0 atau lebih)",
        path: ["freeCustomerLimit"],
      });
    }
  }
  if (data.pppPackageChangeQuotaMode !== "limited") return;
  if (
    data.pppPackageChangeLimit == null ||
    !Number.isFinite(data.pppPackageChangeLimit)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Masukkan batas upgrade dan downgrade bulan ini (0 atau lebih)",
      path: ["pppPackageChangeLimit"],
    });
  }
}

function refineMitraFinancialSettings(
  data: { role: EditableUserRole; omset?: number | null },
  ctx: z.RefinementCtx
) {
  if (data.role !== "Admin") return;
  const omsetErr = validateMitraOmsetPercent(
    data.omset as number | null | undefined
  );
  if (omsetErr) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: omsetErr,
      path: ["omset"],
    });
  }
}

export const UserSchema = UserBaseSchema.superRefine((data, ctx) => {
  refineStaffMenuWhitelist(data, ctx);
  refineFreeCustomerQuota(data, ctx);
  refineMitraFinancialSettings(data, ctx);
});
export type User = z.infer<typeof UserSchema>;
export type UserEdit = z.infer<typeof UserEditSchema>;

export const UserEditSchema = UserBaseSchema.extend({
  password: z
    .union([
      z.literal(""),
      z.string().min(8, { message: "Minimal 8 karakter" }),
    ])
    .optional(),
  role: z.enum(editRoleValues, {
    invalid_type_error: "Required",
    message: "Required",
  }),
}).superRefine((data, ctx) => {
  refineStaffMenuWhitelist(data, ctx);
  refineFreeCustomerQuota(data, ctx);
  refineMitraFinancialSettings(data, ctx);
});

export const UserRegisterSchema = UserOptionalDefaultsSchema.pick({
  user: true,
  password: true,
  nama: true,
  no_identitas: true,
  npwp: true,
}).merge(
  z.object({
    nomor: z.string().min(1, "Required"),
    alamat: z.string().min(1, "Required"),
    file_identitas: z.instanceof(File).or(z.string()).nullish(),
    file_npwp: z.instanceof(File).or(z.string()).nullish(),
  })
);
export type UserRegister = z.infer<typeof UserRegisterSchema>;

export const ClientSchema = UserOptionalDefaultsSchema.pick({
  id: true,
  nama: true,
  user: true,
  password: true,
  alamat: true,
  nomor: true,
})
  .merge(
    ClientOptionalDefaultsSchema.pick({
      tgl: true,
      institusi: true,
      kota: true,
      pos: true,
      telepon: true,
    })
  )
  .merge(
    z.object({
      pj: z
        .object({
          jabatan: z.string().min(1, "Required"),
        })
        .merge(
          ClientPeroranganOptionalDefaultsSchema.pick({
            nama: true,
            nomor: true,
            email: true,
          })
        ),
      teknisi: z
        .object({
          sama: z.boolean(),
          nama: z.string().nullish(),
          nomor: z.string().nullish(),
          email: z.string().nullish(),
        })
        .superRefine((data, ctx) => {
          if (!data.sama) {
            if (!data.nama)
              ctx.addIssue({
                code: "custom",
                message: "Required",
                path: ["nama"],
              });
            if (!data.nomor)
              ctx.addIssue({
                code: "custom",
                message: "Required",
                path: ["nomor"],
              });
          }
        }),
      keuangan: z
        .object({
          sama: z.boolean(),
          nama: z.string().nullish(),
          nomor: z.string().nullish(),
          email: z.string().nullish(),
        })
        .superRefine((data, ctx) => {
          if (!data.sama) {
            if (!data.nama)
              ctx.addIssue({
                code: "custom",
                message: "Required",
                path: ["nama"],
              });
            if (!data.nomor)
              ctx.addIssue({
                code: "custom",
                message: "Required",
                path: ["nomor"],
              });
          }
        }),
      identitas: z.object({
        jenis: z.nativeEnum(Identitas, {
          errorMap: () => ({ message: "Required" }),
        }),
        nomor: z.string().min(1, "Required"),
        file_identitas: z.instanceof(File).or(z.string()).nullish(),
      }),
      npwp: z.object({
        nomor: z.string().min(1, "Required"),
        file_npwp: z.instanceof(File).or(z.string()).nullish(),
      }),
    })
  );

export type Client = z.infer<typeof ClientSchema>;
