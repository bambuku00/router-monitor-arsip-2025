import { monthJatuhTempoRange } from "@/lib/billing-due-date";
import {
  classifyKosongTagihan,
  loadPelangganBayarKosongSignals,
} from "@/lib/pembayaran-pelanggan-bayar-filter";
import { isPelangganGratis } from "@/lib/pelanggan-billing-category";
import { pelangganUntukPenagihanWhere } from "@/lib/pembayaran-pelanggan-scope";
import { isPppIsolir } from "@/lib/ppp-isolir";
import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export type PppPelangganCounts = {
  /** Semua user PPP mitra (sama tab Semua di halaman PPPoE) */
  total: number;
  /** PPP belum punya data pelanggan (sama tab Belum di PPPoE) */
  belumInput: number;
  /** Pelanggan terhubung ke PPP yang masih ada */
  terhubung: number;
  /** Punya tagihan bulan terpilih */
  tagihan: number;
  berhenti: number;
  gratis: number;
  belumWaktunya: number;
  /** Eligible tapi belum ada tagihan bulan ini */
  tanpaTagihan: number;
  /** Isolir masih terbuka lebih dari 1 bulan */
  tidakTerbayar: number;
};

function pppRouterWhere(
  mitraUserId: number,
  routerId?: number | null
): Prisma.PppSecretWhereInput {
  return {
    router: {
      userId: mitraUserId,
      deleted: false,
      ...(routerId ? { id: routerId } : {}),
    },
  };
}

/** Jumlah PPP semua & belum input — selaras halaman Router / PPPoE. */
export async function countPppSemuaDanBelumInput(
  mitraUserId: number,
  routerId?: number | null
): Promise<{
  semua: number;
  belumInput: number;
}> {
  const routerWhere = pppRouterWhere(mitraUserId, routerId);
  const [semua, belumInput] = await Promise.all([
    prisma.pppSecret.count({ where: routerWhere }),
    prisma.pppSecret.count({
      where: { ...routerWhere, pelanggan: null },
    }),
  ]);
  return { semua, belumInput };
}

export type PppBelumInputRow = {
  id: number;
  name: string;
  profile: string;
  on_router: boolean;
  router: { id: number; nama: string };
};

/** Daftar PPP mitra yang belum punya data pelanggan (tab Belum di PPPoE). */
export async function listPppBelumInputPaginated(params: {
  mitraUserId: number;
  page: number;
  limit: number;
  q?: string;
  routerId?: number | null;
}): Promise<{
  rows: PppBelumInputRow[];
  total: number;
  totalPages: number;
}> {
  const where: Prisma.PppSecretWhereInput = {
    ...pppRouterWhere(params.mitraUserId, params.routerId),
    pelanggan: null,
    ...(params.q
      ? {
          OR: [
            { name: { contains: params.q } },
            { router: { nama: { contains: params.q } } },
          ],
        }
      : {}),
  };

  const total = await prisma.pppSecret.count({ where });
  const totalPages = Math.ceil(total / params.limit) || 1;
  const rows = await prisma.pppSecret.findMany({
    where,
    skip: (params.page - 1) * params.limit,
    take: params.limit,
    orderBy: [{ router: { nama: "asc" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      profile: true,
      on_router: true,
      router: { select: { id: true, nama: true } },
    },
  });

  return { rows, total, totalPages };
}

/**
 * Jumlah pelanggan PPP per kategori untuk satu mitra & bulan (sama seperti halaman pembayaran).
 */
export async function getPppPelangganCountsForBulan(
  mitraUserId: number,
  bulan: string,
  staffPelangganWhere: Prisma.PelangganWhereInput = {},
  routerId?: number | null
): Promise<PppPelangganCounts> {
  if (!/^\d{4}-\d{2}$/.test(bulan.trim())) {
    return {
      total: 0,
      belumInput: 0,
      terhubung: 0,
      tagihan: 0,
      berhenti: 0,
      gratis: 0,
      belumWaktunya: 0,
      tanpaTagihan: 0,
      tidakTerbayar: 0,
    };
  }

  const jatuhTempoRange = monthJatuhTempoRange(bulan);

  const [mitra, pelangganRows, pembayaranRows, pppCounts] = await Promise.all([
    prisma.user.findUnique({
      where: { id: mitraUserId },
      select: { billingStartMode: true, billingStartDate: true, ownedByIsp: true },
    }),
    prisma.pelanggan.findMany({
      where: {
        router: {
          userId: mitraUserId,
          ...(routerId ? { id: routerId } : {}),
        },
        ...pelangganUntukPenagihanWhere,
        ...staffPelangganWhere,
      },
      select: {
        id: true,
        stop: true,
        tgl: true,
        isFreeCustomer: true,
        paket: { select: { harga: true } },
        ppp_secret: { select: { profile: true, isIsolir: true } },
        router: { select: { isolirProfileName: true } },
      },
    }),
    prisma.pembayaran.findMany({
      where: {
        jatuh_tempo: jatuhTempoRange,
        pelanggan: {
          router: {
            userId: mitraUserId,
            ...(routerId ? { id: routerId } : {}),
          },
          ...staffPelangganWhere,
        },
      },
      select: { id: true, pelangganId: true },
    }),
    countPppSemuaDanBelumInput(mitraUserId, routerId),
  ]);

  const pembayaranByPelanggan = new Map<number, (typeof pembayaranRows)[number]>();
  for (const row of pembayaranRows) {
    pembayaranByPelanggan.set(row.pelangganId, row);
  }

  const terhubung = pelangganRows.length;
  const { semua: totalPpp, belumInput } = pppCounts;
  const tidakTerbayar = pelangganRows.filter(
    (pel) =>
      !pel.stop &&
      !isPelangganGratis(pel) &&
      !pembayaranByPelanggan.has(pel.id) &&
      pel.ppp_secret != null &&
      isPppIsolir(pel.ppp_secret, {
        isolirProfileName: pel.router?.isolirProfileName,
      })
  ).length;

  /** Belum ada tagihan bulan ini: kategori nol; Total tetap semua PPP. */
  if (pembayaranRows.length === 0) {
    return {
      total: totalPpp,
      belumInput,
      terhubung,
      tagihan: 0,
      berhenti: 0,
      gratis: 0,
      belumWaktunya: 0,
      tanpaTagihan: 0,
      tidakTerbayar,
    };
  }

  const billingStartMode = mitra?.billingStartMode ?? "NEXT_MONTH";
  const billingStartDate = mitra?.billingStartDate ?? null;
  const ownedByIsp = mitra?.ownedByIsp === true;

  const kosongRows = pelangganRows.filter(
    (pel) =>
      !pembayaranByPelanggan.has(pel.id) &&
      !pel.stop &&
      Math.round(Number(pel.paket.harga)) > 0
  );
  const isolirIds = new Set(
    kosongRows
      .filter(
        (pel) =>
          pel.ppp_secret != null &&
          isPppIsolir(pel.ppp_secret, {
            isolirProfileName: pel.router?.isolirProfileName,
          })
      )
      .map((pel) => pel.id)
  );
  const kosongSignals = await loadPelangganBayarKosongSignals(
    kosongRows.map((pel) => pel.id),
    bulan,
    isolirIds
  );

  let tagihan = 0;
  let berhenti = 0;
  let gratis = 0;
  let belumWaktunya = 0;
  let tanpaTagihan = 0;
  const countedPembIds = new Set<number>();

  const linkedPelangganIds = new Set(pelangganRows.map((p) => p.id));

  for (const pel of pelangganRows) {
    const pemb = pembayaranByPelanggan.get(pel.id);

    if (pemb) {
      tagihan += 1;
      countedPembIds.add(pemb.id);
      continue;
    }

    if (pel.stop) {
      berhenti += 1;
      continue;
    }

    if (Math.round(Number(pel.paket.harga)) <= 0) {
      gratis += 1;
      continue;
    }

    const signal = kosongSignals.get(pel.id);
    const kategori = classifyKosongTagihan({
      tgl: pel.tgl,
      period: bulan,
      billingStartMode,
      billingStartDate,
      ownedByIsp,
      hasAnyInvoice: signal?.hasAnyInvoice ?? false,
      hasInvoiceNextMonth: signal?.hasInvoiceNextMonth ?? false,
      isolirStartedAt: signal?.isolirStartedAt ?? null,
      isIsolir: isolirIds.has(pel.id),
    });
    if (kategori === "belum_waktunya") belumWaktunya += 1;
    else if (kategori === "tanpa_tagihan") tanpaTagihan += 1;
  }

  for (const pemb of pembayaranRows) {
    if (countedPembIds.has(pemb.id)) continue;
    if (!linkedPelangganIds.has(pemb.pelangganId)) {
      tagihan += 1;
    }
  }

  return {
    total: totalPpp,
    belumInput,
    terhubung,
    tagihan,
    berhenti,
    gratis,
    belumWaktunya,
    tanpaTagihan,
    tidakTerbayar,
  };
}
