import { logActivityEvent } from "@/lib/activity-audit-log";
import { createBackfillPembayaranForPelanggan } from "@/lib/pembayaran-backfill";
import {
  assertFreeCustomerQuotaAllowed,
  FreeCustomerQuotaExceededError,
} from "@/lib/free-customer-quota";
import { resolveIsFreeCustomerForPaket } from "@/lib/pelanggan-billing-category";
import {
  allocateNoLayananForCreate,
  dateFromPelangganTgl,
  isLegacyNoLayanan,
} from "@/lib/pelanggan-no-layanan";
import {
  buildAmbiguousNormalizedNameSet,
  duplicatePaketDisplayLabels,
  type BulkFillMode,
  type BulkFillPaketRow,
  resolvePaketForAutoFill,
} from "@/lib/ppp-bulk-fill-resolve-paket";
import { AUTO_FILL_NO_PACKAGE_MESSAGE } from "@/lib/ppp-auto-fill-message";
import type { PppCustomerDirectoryRow } from "@/lib/ppp-customer-directory";
import prisma from "@/lib/prisma";
import type { BillingStartMode } from "@prisma/client";

export { AUTO_FILL_NO_PACKAGE_MESSAGE } from "@/lib/ppp-auto-fill-message";

export type BulkFillSkipReason =
  | "no_active_package"
  | "package_profile_mismatch"
  | "free_package_not_allowed_as_fallback"
  | "free_customer_quota_exceeded"
  | "duplicate_customer"
  | "ambiguous_package_profile";

export const BULK_FILL_SKIP_REASONS: BulkFillSkipReason[] = [
  "no_active_package",
  "package_profile_mismatch",
  "free_package_not_allowed_as_fallback",
  "free_customer_quota_exceeded",
  "duplicate_customer",
  "ambiguous_package_profile",
];

export type BulkFillPelangganResult = {
  created: number;
  linked: number;
  failed: number;
  skips: Record<BulkFillSkipReason, number>;
  skipNames: Partial<Record<BulkFillSkipReason, string[]>>;
  ambiguousPackageNames: string[];
};

export function createEmptyBulkFillSkips(): Record<BulkFillSkipReason, number> {
  return {
    no_active_package: 0,
    package_profile_mismatch: 0,
    free_package_not_allowed_as_fallback: 0,
    free_customer_quota_exceeded: 0,
    duplicate_customer: 0,
    ambiguous_package_profile: 0,
  };
}

const SKIP_SUMMARY_LABELS: Record<BulkFillSkipReason, string> = {
  no_active_package: "Dilewati (belum ada paket aktif)",
  package_profile_mismatch: "Dilewati (profil tidak cocok)",
  free_package_not_allowed_as_fallback:
    "Dilewati (paket gratis tidak boleh fallback otomatis)",
  free_customer_quota_exceeded: "Dilewati (kuota pelanggan gratis habis)",
  duplicate_customer: "Dilewati (username PPPoE sudah terhubung)",
  ambiguous_package_profile: "Dilewati (nama paket ambigu/duplikat)",
};

export function formatBulkFillPelangganSummary(
  result: BulkFillPelangganResult
): string {
  const succeeded = result.created + result.linked;
  const lines = ["Auto Isi selesai.", "", `Berhasil dibuat/ditautkan: ${succeeded}`];

  for (const reason of BULK_FILL_SKIP_REASONS) {
    const count = result.skips[reason];
    if (count > 0) {
      lines.push(`${SKIP_SUMMARY_LABELS[reason]}: ${count}`);
    }
  }

  if (result.ambiguousPackageNames.length > 0) {
    lines.push(
      `Nama paket duplikat (perlu diperbaiki): ${result.ambiguousPackageNames.join(", ")}`
    );
  }

  lines.push(`Gagal: ${result.failed}`);
  return lines.join("\n");
}

function pelangganNamaFromPpp(secret: {
  name: string;
  comment: string | null;
}) {
  const comment = secret.comment?.trim();
  if (comment && comment !== secret.name.trim()) return comment;
  return secret.name.trim();
}

function tglFromSecretCreated(created: Date): string {
  return new Date(created).toLocaleDateString("fr-CA");
}

function recordSkip(
  result: BulkFillPelangganResult,
  reason: BulkFillSkipReason,
  secretName: string
): void {
  result.skips[reason] += 1;
  const list = result.skipNames[reason] ?? [];
  list.push(secretName);
  result.skipNames[reason] = list;
}

async function createBackfillPembayaran(params: {
  pelangganId: number;
  paketId: number;
  tgl: string;
  inputterId: number;
  ppnRate: number;
  billingStartMode: BillingStartMode | null;
  billingStartDate: Date | null;
  ownedByIsp?: boolean;
}) {
  await createBackfillPembayaranForPelanggan(params);
}

/** Isi nama, nomor, dan alamat pelanggan yang masih auto isi. Pelanggan yang sudah diubah manual tidak disentuh. */
export async function applyCustomerDirectoryToAutoFilled(
  routerId: number,
  directory: Map<string, PppCustomerDirectoryRow>
): Promise<{
  updated: number;
  alreadySame: number;
  skippedNoCustomer: number;
}> {
  const rows = await prisma.pelanggan.findMany({
    where: {
      routerId,
      autoFilledAt: { not: null },
      ppp_secret: { isNot: null },
    },
    select: {
      id: true,
      nama: true,
      nomor: true,
      alamat: true,
      ppp_secret: { select: { name: true } },
    },
  });

  let updated = 0;
  let alreadySame = 0;
  const matched = new Set<string>();

  for (const row of rows) {
    const secretName = row.ppp_secret?.name?.trim().toLowerCase();
    if (!secretName) continue;
    const hit = directory.get(secretName);
    if (!hit) continue;
    matched.add(secretName);
    const same =
      row.nama === hit.nama &&
      row.nomor === hit.nomor &&
      row.alamat === hit.alamat;
    const lengkap =
      hit.nama !== "-" && hit.nomor !== "-" && hit.alamat !== "-";
    if (same && !lengkap) {
      alreadySame += 1;
      continue;
    }
    await prisma.pelanggan.update({
      where: { id: row.id },
      data: {
        nama: hit.nama,
        nomor: hit.nomor,
        alamat: hit.alamat,
        ...(lengkap ? { autoFilledAt: null } : {}),
      },
    });
    if (same) alreadySame += 1;
    else updated += 1;
  }

  return {
    updated,
    alreadySame,
    skippedNoCustomer: Math.max(0, directory.size - matched.size),
  };
}

export function formatCustomerDirectoryImportSummary(result: {
  updated: number;
  alreadySame: number;
  skippedNoCustomer: number;
}): string {
  return [
    "Impor selesai.",
    "",
    `Pelanggan auto isi diperbarui: ${result.updated}`,
    `Sudah sesuai file: ${result.alreadySame}`,
    `Username tanpa pelanggan auto isi di router ini: ${result.skippedNoCustomer}`,
  ].join("\n");
}

export async function bulkFillPelangganFromPpp(
  routerId: number,
  inputterId: number,
  options?: { defaultPaketId?: number; mode?: BulkFillMode }
): Promise<BulkFillPelangganResult> {
  const mode: BulkFillMode = options?.mode ?? "manual";

  const router = await prisma.router.findUnique({
    where: { id: routerId },
    include: {
      users: {
        select: {
          id: true,
          ppn: true,
          billingStartMode: true,
          billingStartDate: true,
          ownedByIsp: true,
        },
      },
    },
  });
  if (!router?.users) {
    throw new Error("Router atau mitra tidak ditemukan");
  }

  const mitra = router.users;
  const pakets: BulkFillPaketRow[] = await prisma.paket.findMany({
    where: { userId: mitra.id, deleted: false },
    select: { id: true, nama: true, harga: true },
    orderBy: { nama: "asc" },
  });

  if (pakets.length === 0) {
    throw new Error(AUTO_FILL_NO_PACKAGE_MESSAGE);
  }

  const ambiguousNormalized = buildAmbiguousNormalizedNameSet(pakets);
  const ambiguousPackageNames = duplicatePaketDisplayLabels(pakets);

  const secrets = await prisma.pppSecret.findMany({
    where: {
      routerId,
      pelanggan: null,
    },
    select: {
      id: true,
      name: true,
      comment: true,
      profile: true,
      created: true,
    },
    orderBy: { name: "asc" },
  });

  const result: BulkFillPelangganResult = {
    created: 0,
    linked: 0,
    failed: 0,
    skips: createEmptyBulkFillSkips(),
    skipNames: {},
    ambiguousPackageNames,
  };

  const inputter = await prisma.user.findUnique({
    where: { id: inputterId },
    select: { id: true, role: true, user: true },
  });
  if (!inputter) {
    throw new Error("User input tidak ditemukan");
  }

  const ppnRate = (mitra.ppn ?? 11) / 100;

  for (const secret of secrets) {
    const resolved = resolvePaketForAutoFill({
      profile: secret.profile,
      pakets,
      mode,
      defaultPaketId: options?.defaultPaketId,
      ambiguousNormalizedNames: ambiguousNormalized,
    });

    if (!resolved.ok) {
      recordSkip(result, resolved.reason, secret.name);
      continue;
    }

    const matchedPaket = resolved.paket;
    const isFreeCustomer = resolveIsFreeCustomerForPaket(matchedPaket.harga);

    const nama = pelangganNamaFromPpp(secret);
    const nomor = "-";
    const alamat = "-";
    const tgl = tglFromSecretCreated(secret.created);

    const secretName = secret.name.trim();
    const activeDuplicate = await prisma.pelanggan.findFirst({
      where: {
        routerId,
        ppp_secret: { name: secretName },
      },
      select: { id: true },
    });
    if (activeDuplicate) {
      recordSkip(result, "duplicate_customer", secret.name);
      continue;
    }

    const orphan = await prisma.pelanggan.findFirst({
      where: {
        routerId,
        nama: secretName,
        ppp_secretId: null,
      },
      orderBy: { id: "asc" },
      select: { id: true, noLayanan: true },
    });

    if (isFreeCustomer) {
      try {
        await assertFreeCustomerQuotaAllowed({
          ownerUserId: mitra.id,
          paketHarga: matchedPaket.harga,
          excludePelangganId: orphan?.id,
        });
      } catch (err) {
        if (err instanceof FreeCustomerQuotaExceededError) {
          recordSkip(result, "free_customer_quota_exceeded", secret.name);
          continue;
        }
        throw err;
      }
    }

    const autoFilledAt = new Date();
    const pelanggan = orphan
      ? await prisma.pelanggan.update({
          where: { id: orphan.id },
          data: {
            ppp_secretId: secret.id,
            paketId: matchedPaket.id,
            isFreeCustomer,
            stop: false,
            alamat,
            nomor,
            email: "",
            tgl,
            autoFilledAt,
            lat: router.lat ?? undefined,
            lng: router.lng ?? undefined,
            ...(isLegacyNoLayanan(orphan.noLayanan)
              ? {
                  noLayanan: await allocateNoLayananForCreate(
                    dateFromPelangganTgl(tgl)
                  ),
                }
              : {}),
          },
        })
      : await prisma.pelanggan.create({
          data: {
            routerId,
            ppp_secretId: secret.id,
            paketId: matchedPaket.id,
            isFreeCustomer,
            nama,
            alamat,
            nomor,
            email: "",
            tgl,
            stop: false,
            autoFilledAt,
            noLayanan: await allocateNoLayananForCreate(
              dateFromPelangganTgl(tgl)
            ),
            lat: router.lat ?? undefined,
            lng: router.lng ?? undefined,
          },
        });

    if (orphan) result.linked += 1;
    else result.created += 1;

    await createBackfillPembayaran({
      pelangganId: pelanggan.id,
      paketId: matchedPaket.id,
      tgl,
      inputterId,
      ppnRate,
      billingStartMode: mitra.billingStartMode,
      billingStartDate: mitra.billingStartDate,
      ownedByIsp: mitra.ownedByIsp === true,
    });
  }

  return result;
}

export async function logDailyAutoFillRun(params: {
  routerId: number;
  ownerUserId: number;
  result: BulkFillPelangganResult;
}): Promise<void> {
  logActivityEvent({
    action: "ppp_auto_fill_daily",
    userId: params.ownerUserId,
    reason: `router:${params.routerId}`,
    meta: {
      routerId: params.routerId,
      created: params.result.created,
      linked: params.result.linked,
      skips: params.result.skips,
    },
  });
}

export function startOfLocalDay(date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function hasDailyAutoFillRunToday(
  routerId: number,
  now = new Date()
): Promise<boolean> {
  const existing = await prisma.auditLog.findFirst({
    where: {
      action: "ppp_auto_fill_daily",
      reason: `router:${routerId}`,
      created: { gte: startOfLocalDay(now) },
    },
    select: { id: true },
  });
  return existing != null;
}
