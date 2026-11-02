import { getFirstBillingMonth, isPelangganEligibleForBillingPeriod } from "@/lib/billing-start";
import { monthJatuhTempoRange } from "@/lib/billing-due-date";
import { BILLING, TIME } from "@/lib/constants";
import {
  sortPelangganIdsBelumDulu,
  sortPelangganIdsByDiproses,
  type PelangganUrutan,
} from "@/lib/pembayaran-diproses-sort";
import { isPelangganGratis } from "@/lib/pelanggan-billing-category";
import { isPppIsolir } from "@/lib/ppp-isolir";
import prisma from "@/lib/prisma";
import type { BillingStartMode, Prisma } from "@prisma/client";

export const PELANGGAN_BAYAR_FILTERS = [
  "semua",
  "total",
  "belum_input",
  "tagihan",
  "terbayar",
  "belum",
  "berhenti",
  "gratis",
  "belum_waktunya",
  "tanpa_tagihan",
  "tidak_terbayar",
] as const;

export type PelangganBayarFilter = (typeof PELANGGAN_BAYAR_FILTERS)[number];

/** Filter yang dipetakan dari chip PPPoE di statistik. */
export const PPP_CHIP_BAYAR_FILTERS = [
  "total",
  "belum_input",
  "tagihan",
  "berhenti",
  "gratis",
  "belum_waktunya",
  "tanpa_tagihan",
  "tidak_terbayar",
] as const;

export type PppChipBayarFilter = (typeof PPP_CHIP_BAYAR_FILTERS)[number];

export const PELANGGAN_BAYAR_FILTER_LABELS: Record<PelangganBayarFilter, string> = {
  semua: "Semua",
  total: "Total PPPoE",
  belum_input: "Belum input",
  tagihan: "Tagihan",
  terbayar: "Sudah bayar",
  belum: "Belum bayar",
  berhenti: "Berhenti",
  gratis: "Gratis",
  belum_waktunya: "Belum waktunya",
  tanpa_tagihan: "Tanpa tagihan",
  tidak_terbayar: "Tidak terbayar",
};

export function parsePelangganBayarFilter(
  raw: string | null | undefined
): PelangganBayarFilter {
  const v = raw?.toLowerCase().trim();
  if (
    v === "total" ||
    v === "belum_input" ||
    v === "tagihan" ||
    v === "terbayar" ||
    v === "belum" ||
    v === "berhenti" ||
    v === "gratis" ||
    v === "belum_waktunya" ||
    v === "tanpa_tagihan" ||
    v === "tidak_terbayar"
  ) {
    return v;
  }
  return "semua";
}

export function isPppChipBayarFilter(
  filter: PelangganBayarFilter
): filter is PppChipBayarFilter {
  return (PPP_CHIP_BAYAR_FILTERS as readonly string[]).includes(filter);
}

export function isTagihanStatusBayarFilter(
  filter: PelangganBayarFilter
): filter is "terbayar" | "belum" {
  return filter === "terbayar" || filter === "belum";
}

export function isPelangganKategoriBayarFilter(
  filter: PelangganBayarFilter
): filter is "berhenti" | "gratis" | "belum_waktunya" | "tanpa_tagihan" | "tidak_terbayar" {
  return (
    filter === "berhenti" ||
    filter === "gratis" ||
    filter === "belum_waktunya" ||
    filter === "tanpa_tagihan" ||
    filter === "tidak_terbayar"
  );
}

export function addBillingMonths(period: string, delta: number): string {
  const [year, month] = period.split("-").map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Isolir yang masih berjalan sudah lewat 1 bulan (30 hari). */
export function isolirSudahLebihDariSebulan(
  startedAt: Date | null | undefined,
  now: Date = new Date()
): boolean {
  if (!startedAt) return false;
  return (
    now.getTime() - startedAt.getTime() >
    BILLING.BILLING_CYCLE_DAYS * TIME.ONE_DAY_MS
  );
}

/** Awal isolir yang masih terbuka. Restore setelahnya menghapus awal itu. */
export function openIsolirStartedAt(
  logs: { action: "isolate" | "restore"; created: Date }[]
): Date | null {
  let started: Date | null = null;
  const ordered = [...logs].sort(
    (left, right) => left.created.getTime() - right.created.getTime()
  );
  for (const log of ordered) {
    if (log.action === "isolate") started = log.created;
    else started = null;
  }
  return started;
}

export type KosongTagihanKategori = "belum_waktunya" | "tanpa_tagihan";

/**
 * Belum waktunya = pasang baru yang belum punya tagihan dan tidak sedang isolir.
 * Tanpa tagihan = sudah waktunya, tagihan bulan ini tidak ada, dan bukan pasang baru.
 * Status isolir tanpa tagihan bulan ini masuk Tidak terbayar, bukan kedua filter di atas.
 */
export function classifyKosongTagihan(params: {
  tgl: string;
  period: string;
  billingStartMode: BillingStartMode | null;
  billingStartDate: Date | null;
  ownedByIsp?: boolean;
  hasAnyInvoice: boolean;
  hasInvoiceNextMonth: boolean;
  isolirStartedAt: Date | null;
  isIsolir?: boolean;
  now?: Date;
}): KosongTagihanKategori | null {
  if (params.isIsolir === true) return null;
  const eligible = isPelangganEligibleForBillingPeriod({
    tgl: params.tgl,
    period: params.period,
    billingStartMode: params.billingStartMode,
    billingStartDate: params.billingStartDate,
    ownedByIsp: params.ownedByIsp,
  });
  const firstPeriod = getFirstBillingMonth({
    tgl: params.tgl,
    billingStartMode: params.billingStartMode,
    billingStartDate: params.billingStartDate,
    ownedByIsp: params.ownedByIsp,
  });
  const pasangBaru = !params.hasAnyInvoice && params.period <= firstPeriod;
  if (!eligible || pasangBaru) return "belum_waktunya";
  return "tanpa_tagihan";
}

type BayarKosongSignals = {
  hasAnyInvoice: boolean;
  hasInvoiceNextMonth: boolean;
  isolirStartedAt: Date | null;
};

export async function loadPelangganBayarKosongSignals(
  pelangganIds: number[],
  period: string,
  isolirIds: Set<number>
): Promise<Map<number, BayarKosongSignals>> {
  const signals = new Map<number, BayarKosongSignals>();
  if (pelangganIds.length === 0) return signals;

  const nextRange = monthJatuhTempoRange(addBillingMonths(period, 1));
  const [invoices, logs] = await Promise.all([
    prisma.pembayaran.findMany({
      where: { pelangganId: { in: pelangganIds } },
      select: { pelangganId: true, jatuh_tempo: true },
    }),
    isolirIds.size === 0
      ? Promise.resolve(
          [] as {
            pelangganId: number | null;
            action: "isolate" | "restore";
            created: Date;
          }[]
        )
      : prisma.autoIsolirLog.findMany({
          where: {
            pelangganId: { in: [...isolirIds] },
            status: "success",
            dryRun: false,
            action: { in: ["isolate", "restore"] },
          },
          orderBy: { created: "asc" },
          select: { pelangganId: true, action: true, created: true },
        }),
  ]);

  const anyInvoice = new Set<number>();
  const nextInvoice = new Set<number>();
  for (const row of invoices) {
    anyInvoice.add(row.pelangganId);
    if (row.jatuh_tempo >= nextRange.gte && row.jatuh_tempo <= nextRange.lte) {
      nextInvoice.add(row.pelangganId);
    }
  }

  const logsByPelanggan = new Map<
    number,
    { action: "isolate" | "restore"; created: Date }[]
  >();
  for (const log of logs) {
    if (log.pelangganId == null) continue;
    const list = logsByPelanggan.get(log.pelangganId) ?? [];
    list.push({ action: log.action, created: log.created });
    logsByPelanggan.set(log.pelangganId, list);
  }

  for (const id of pelangganIds) {
    signals.set(id, {
      hasAnyInvoice: anyInvoice.has(id),
      hasInvoiceNextMonth: nextInvoice.has(id),
      isolirStartedAt: isolirIds.has(id)
        ? openIsolirStartedAt(logsByPelanggan.get(id) ?? [])
        : null,
    });
  }
  return signals;
}

function noTagihanBulanIniWhere(jatuhTempoRange: {
  gte: string;
  lte: string;
}): Prisma.PelangganWhereInput {
  return {
    NOT: {
      pembayaran: {
        some: { jatuh_tempo: jatuhTempoRange },
      },
    },
  };
}

/** Where tambahan untuk filter berhenti / gratis (tanpa tagihan bulan ini). */
export function pelangganKategoriBayarWhere(
  filter: "berhenti" | "gratis",
  jatuhTempoRange: { gte: string; lte: string }
): Prisma.PelangganWhereInput {
  const noTagihan = noTagihanBulanIniWhere(jatuhTempoRange);
  if (filter === "berhenti") {
    return { stop: true, ...noTagihan };
  }
  return {
    stop: false,
    OR: [{ isFreeCustomer: true }, { paket: { harga: { lte: 0 } } }],
    ...noTagihan,
  };
}

/** Tampilkan di filter Semua: tagihan, berhenti, gratis, belum waktunya, isolir — bukan eligible tanpa tagihan. */
export function pelangganRelevantForBillingMonth(
  pel: {
    id: number;
    stop: boolean;
    tgl: string;
    isFreeCustomer?: boolean;
    paket: { harga: number };
  },
  hasTagihanBulanIni: boolean,
  ctx: {
    billingPeriod: string;
    billingStartMode: BillingStartMode | null;
    billingStartDate: Date | null;
    ownedByIsp?: boolean;
  },
  sedangIsolir = false
): boolean {
  if (hasTagihanBulanIni) return true;
  if (sedangIsolir) return true;
  if (pel.stop) return true;
  if (isPelangganGratis(pel)) return true;
  if (
    !isPelangganEligibleForBillingPeriod({
      tgl: pel.tgl,
      period: ctx.billingPeriod,
      billingStartMode: ctx.billingStartMode,
      billingStartDate: ctx.billingStartDate,
      ownedByIsp: ctx.ownedByIsp,
    })
  ) {
    return true;
  }
  return false;
}

async function findPelangganPage<TInclude extends Prisma.PelangganInclude>(
  pageIds: number[],
  include: TInclude
): Promise<Prisma.PelangganGetPayload<{ include: TInclude }>[]> {
  if (pageIds.length === 0) return [];
  const rows = await prisma.pelanggan.findMany({
    where: { id: { in: pageIds } },
    include,
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  return pageIds.flatMap((id) => {
    const row = byId.get(id);
    return row ? [row] : [];
  });
}

async function slicePelangganIds(
  ids: number[],
  page: number,
  limit: number,
  sort: PelangganUrutan | null | undefined,
  jatuhTempoRange: { gte: string; lte: string }
) {
  const ordered =
    sort === "belum"
      ? await sortPelangganIdsBelumDulu(ids, jatuhTempoRange)
      : sort
        ? await sortPelangganIdsByDiproses(ids, jatuhTempoRange, sort)
        : ids;
  const total = ordered.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const pageIds = ordered.slice((page - 1) * limit, page * limit);
  return { total, totalPages, pageIds };
}

/** Filter Semua + bulan: tampilkan pelanggan relevan termasuk isolir tanpa tagihan bulan ini. */
export async function listPelangganSemuaBulanPaginated<
  TInclude extends Prisma.PelangganInclude,
>(params: {
  baseWhere: Prisma.PelangganWhereInput;
  jatuhTempoRange: { gte: string; lte: string };
  billingPeriod: string;
  billingStartMode: BillingStartMode | null;
  billingStartDate: Date | null;
  ownedByIsp?: boolean;
  sort?: PelangganUrutan | null;
  page: number;
  limit: number;
  include: TInclude;
}) {
  const pembRows = await prisma.pembayaran.findMany({
    where: {
      jatuh_tempo: params.jatuhTempoRange,
      pelanggan: params.baseWhere,
    },
    select: { pelangganId: true },
  });

  const [candidates] = await Promise.all([
    prisma.pelanggan.findMany({
      where: params.baseWhere,
      select: {
        id: true,
        stop: true,
        tgl: true,
        isFreeCustomer: true,
        paket: { select: { harga: true } },
        ppp_secret: {
          select: {
            profile: true,
            isIsolir: true,
            disabled: true,
          },
        },
        router: { select: { isolirProfileName: true } },
      },
      orderBy: { nama: "asc" },
    }),
  ]);

  const hasTagihan = new Set(pembRows.map((p) => p.pelangganId));
  const ctx = {
    billingPeriod: params.billingPeriod,
    billingStartMode: params.billingStartMode,
    billingStartDate: params.billingStartDate,
    ownedByIsp: params.ownedByIsp,
  };

  const ids = candidates
    .filter((p) => {
      const sedangIsolir =
        !p.stop &&
        p.ppp_secret != null &&
        isPppIsolir(p.ppp_secret, {
          isolirProfileName: p.router?.isolirProfileName,
        });
      return pelangganRelevantForBillingMonth(
        p,
        hasTagihan.has(p.id),
        ctx,
        sedangIsolir
      );
    })
    .map((p) => p.id);

  const pageSlice = await slicePelangganIds(
    ids,
    params.page,
    params.limit,
    params.sort,
    params.jatuhTempoRange
  );
  const pelanggan = await findPelangganPage(pageSlice.pageIds, params.include);
  return { pelanggan, total: pageSlice.total, totalPages: pageSlice.totalPages };
}

async function listPelangganKosongTagihanPaginated<
  TInclude extends Prisma.PelangganInclude,
>(
  params: {
    baseWhere: Prisma.PelangganWhereInput;
    jatuhTempoRange: { gte: string; lte: string };
    billingPeriod: string;
    billingStartMode: BillingStartMode | null;
    billingStartDate: Date | null;
    ownedByIsp?: boolean;
    sort?: PelangganUrutan | null;
    page: number;
    limit: number;
    include: TInclude;
  },
  kategori: KosongTagihanKategori
) {
  const candidates = await prisma.pelanggan.findMany({
    where: {
      AND: [
        params.baseWhere,
        { stop: false },
        { paket: { harga: { gt: 0 } } },
        noTagihanBulanIniWhere(params.jatuhTempoRange),
      ],
    },
    select: {
      id: true,
      tgl: true,
      ppp_secret: {
        select: { profile: true, isIsolir: true },
      },
      router: { select: { isolirProfileName: true } },
    },
    orderBy: { nama: "asc" },
  });

  const isolirIds = new Set(
    candidates
      .filter(
        (row) =>
          row.ppp_secret != null &&
          isPppIsolir(row.ppp_secret, {
            isolirProfileName: row.router?.isolirProfileName,
          })
      )
      .map((row) => row.id)
  );
  const signals = await loadPelangganBayarKosongSignals(
    candidates.map((row) => row.id),
    params.billingPeriod,
    isolirIds
  );

  const ids = candidates
    .filter((row) => {
      const signal = signals.get(row.id);
      return (
        classifyKosongTagihan({
          tgl: row.tgl,
          period: params.billingPeriod,
          billingStartMode: params.billingStartMode,
          billingStartDate: params.billingStartDate,
          ownedByIsp: params.ownedByIsp,
          hasAnyInvoice: signal?.hasAnyInvoice ?? false,
          hasInvoiceNextMonth: signal?.hasInvoiceNextMonth ?? false,
          isolirStartedAt: signal?.isolirStartedAt ?? null,
          isIsolir: isolirIds.has(row.id),
        }) === kategori
      );
    })
    .map((row) => row.id);

  const pageSlice = await slicePelangganIds(
    ids,
    params.page,
    params.limit,
    params.sort,
    params.jatuhTempoRange
  );
  const pelanggan = await findPelangganPage(pageSlice.pageIds, params.include);
  return { pelanggan, total: pageSlice.total, totalPages: pageSlice.totalPages };
}

/** Pagination pelanggan belum waktunya tagihan (pasang baru, belum ada tagihan). */
export async function listPelangganBelumWaktunyaPaginated<
  TInclude extends Prisma.PelangganInclude,
>(params: {
  baseWhere: Prisma.PelangganWhereInput;
  jatuhTempoRange: { gte: string; lte: string };
  billingPeriod: string;
  billingStartMode: BillingStartMode | null;
  billingStartDate: Date | null;
  ownedByIsp?: boolean;
  sort?: PelangganUrutan | null;
  page: number;
  limit: number;
  include: TInclude;
}) {
  return listPelangganKosongTagihanPaginated(params, "belum_waktunya");
}

/** Pagination pelanggan sudah waktunya tapi belum ada tagihan bulan ini. */
export async function listPelangganTanpaTagihanPaginated<
  TInclude extends Prisma.PelangganInclude,
>(params: {
  baseWhere: Prisma.PelangganWhereInput;
  jatuhTempoRange: { gte: string; lte: string };
  billingPeriod: string;
  billingStartMode: BillingStartMode | null;
  billingStartDate: Date | null;
  ownedByIsp?: boolean;
  sort?: PelangganUrutan | null;
  page: number;
  limit: number;
  include: TInclude;
}) {
  return listPelangganKosongTagihanPaginated(params, "tanpa_tagihan");
}

/** Isolir tanpa tagihan di bulan yang dibuka (sel bulan bertanda —). */
export async function listPelangganTidakTerbayarPaginated<
  TInclude extends Prisma.PelangganInclude,
>(params: {
  baseWhere: Prisma.PelangganWhereInput;
  jatuhTempoRange: { gte: string; lte: string };
  sort?: PelangganUrutan | null;
  page: number;
  limit: number;
  include: TInclude;
}) {
  const candidates = await prisma.pelanggan.findMany({
    where: {
      AND: [
        params.baseWhere,
        { stop: false },
        noTagihanBulanIniWhere(params.jatuhTempoRange),
      ],
    },
    select: {
      id: true,
      isFreeCustomer: true,
      paket: { select: { harga: true } },
      ppp_secret: { select: { profile: true, isIsolir: true } },
      router: { select: { isolirProfileName: true } },
    },
    orderBy: { nama: "asc" },
  });
  const ids = candidates
    .filter(
      (row) =>
        !isPelangganGratis(row) &&
        row.ppp_secret != null &&
        isPppIsolir(row.ppp_secret, {
          isolirProfileName: row.router?.isolirProfileName,
        })
    )
    .map((row) => row.id);

  const pageSlice = await slicePelangganIds(
    ids,
    params.page,
    params.limit,
    params.sort,
    params.jatuhTempoRange
  );
  const pelanggan = await findPelangganPage(pageSlice.pageIds, params.include);
  return { pelanggan, total: pageSlice.total, totalPages: pageSlice.totalPages };
}

export function pelangganBayarFilterEmptyMessage(
  filter: PelangganBayarFilter,
  monthLabel: string
): string {
  switch (filter) {
    case "semua":
      return `Tidak ada tagihan untuk ${monthLabel}.`;
    case "total":
      return `Tidak ada pelanggan terhubung ke PPP untuk ${monthLabel}.`;
    case "belum_input":
      return "Tidak ada user PPP yang belum diisi data pelanggan.";
    case "tagihan":
      return `Tidak ada pelanggan dengan tagihan untuk ${monthLabel}.`;
    case "belum":
      return `Tidak ada tagihan belum bayar untuk ${monthLabel}.`;
    case "terbayar":
      return `Tidak ada tagihan terbayar untuk ${monthLabel}.`;
    case "berhenti":
      return `Tidak ada pelanggan berhenti untuk ${monthLabel}.`;
    case "gratis":
      return `Tidak ada pelanggan gratis untuk ${monthLabel}.`;
    case "belum_waktunya":
      return `Tidak ada pelanggan belum waktunya tagihan untuk ${monthLabel}.`;
    case "tanpa_tagihan":
      return `Tidak ada pelanggan tanpa tagihan (sudah waktunya) untuk ${monthLabel}.`;
    case "tidak_terbayar":
      return `Tidak ada pelanggan isolir tanpa tagihan untuk ${monthLabel}.`;
  }
}
