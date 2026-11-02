import { z } from "zod";

const RevenueBasisSchema = z.enum(["INVOICE", "PAID"]);
const BillingStartModeSchema = z.enum(["NEXT_MONTH", "IMMEDIATE", "CUSTOM_DATE"]);

function toOptionalId(value: unknown): number | undefined {
  if (value === "" || value == null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function toOptionalDate(value: unknown): Date | null | undefined {
  if (value === "" || value == null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const d = new Date(String(value));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Schema khusus PUT user — hanya field yang dikirim form. */
export const UserPutSchema = z.object({
  id: z.preprocess(toOptionalId, z.number().int().optional()),
  nama: z.string().min(1),
  user: z.string().min(1),
  password: z
    .union([z.literal(""), z.string().min(8, { message: "Minimal 8 karakter" })])
    .optional(),
  role: z
    .enum(["Superadmin", "Admin", "Keuangan", "Teknisi", "Client", "Pending"])
    .optional(),
  parentId: z.preprocess(toOptionalId, z.number().int().nullish().optional()),
  omset: z.number().int().nullish().optional(),
  ppn: z.number().nullish().optional(),
  ppnEnabled: z.boolean().optional(),
  billingYearRestrict: z.number().int().min(2000).max(2100).nullable().optional(),
  revenueBasis: RevenueBasisSchema.optional(),
  billingStartMode: BillingStartModeSchema.optional(),
  billingStartDate: z.preprocess(
    toOptionalDate,
    z.date().nullish().optional()
  ),
  billingGenerateDay: z.number().int().min(1).max(28).nullish().optional(),
  freeCustomerLimit: z.number().int().min(0).nullable().optional(),
  pppPackageChangeLimit: z.number().int().min(0).nullable().optional(),
  pppAutoFillEnabled: z.boolean().optional(),
  portalPelangganEnabled: z.boolean().optional(),
  portalSlug: z.string().max(32).nullable().optional(),
  ownedByIsp: z.boolean().optional(),
  revenueShareEnabled: z.boolean().optional(),
  staffMenuKeys: z.unknown().nullable().optional(),
  staffPelangganScope: z.array(z.number().int()).nullable().optional(),
  staffAllowBankPayment: z.boolean().optional(),
  staffAllowIsolir: z.boolean().optional(),
  staffAllowCancelPayment: z.boolean().optional(),
  staffAllowBerhenti: z.boolean().optional(),
});

export type UserPutBody = z.infer<typeof UserPutSchema>;

export { RevenueBasisSchema, BillingStartModeSchema };
