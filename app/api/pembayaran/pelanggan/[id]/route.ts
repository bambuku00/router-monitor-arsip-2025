import { validateRequest } from "@/lib/auth";
import { logger } from "@/lib/logger";
import {
  parseIsolirPelangganFilter,
  pelangganIsolirFilterClause,
} from "@/lib/pembayaran-isolir-filter";
import {
  parsePenagihPelangganFilter,
  pelangganPenagihFilterClause,
} from "@/lib/pembayaran-penagih-filter";
import { penagihScopeForActor } from "@/lib/penagih-akun";
import { parseMetodeBayarFilter } from "@/lib/pembayaran-metode-filter";
import { clampPetugasBulan } from "@/lib/petugas-bulan";
import {
  hidesMitraDirectory,
  pelangganListExtrasForAudience,
  pppSecretForAudience,
  statusActorsForAudience,
  valuesForAudience,
} from "@/lib/pembayaran-petugas-response";
import { listPppBelumInputPaginated } from "@/lib/pembayaran-ppp-counts";
import { resolveMitraPpnPolicy } from "@/lib/ppn-policy";
import { pelangganUntukPenagihanWhere } from "@/lib/pembayaran-pelanggan-scope";
import {
  isTagihanStatusBayarFilter,
  listPelangganBelumWaktunyaPaginated,
  listPelangganSemuaBulanPaginated,
  listPelangganTanpaTagihanPaginated,
  listPelangganTidakTerbayarPaginated,
  parsePelangganBayarFilter,
  pelangganKategoriBayarWhere,
} from "@/lib/pembayaran-pelanggan-bayar-filter";
import {
  listUserIdProsesKantor,
  pelangganLunasKantorWhere,
} from "@/lib/pembayaran-rekap-petugas";
import {
  enrichPembayaranWithInputters,
  jakartaProcessedDayRange,
  listPembayaranInputtersForRange,
  listPembayaranProcessedDaysForRange,
} from "@/lib/pembayaran-inputter";
import {
  parsePelangganUrutan,
  sortPelangganIdsBelumDulu,
  sortPelangganIdsByDiproses,
} from "@/lib/pembayaran-diproses-sort";
import {
  latestBukaIsolirByPelanggan,
  latestIsolirActorByPelanggan,
} from "@/lib/manual-isolir-log";
import {
  latestBerhentiByPelanggan,
  latestLanjutByPelanggan,
} from "@/lib/pelanggan-status-log";
import { resolveStaffPelangganScopeWhere } from "@/lib/staff-pelanggan-scope";
import { staffMenuApiForbidden } from "@/lib/staff-menu-api";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Pagination and month-scoped pembayaran are required for scale (1000+ pelanggan per mitra).
// Loading all pelanggan and full-year pembayaran causes heavy DB load and large payloads.

export async function GET(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  try {
    const { user, session } = await validateRequest();
    if (!session || !user) {
      return NextResponse.json(
        { error: "Tidak terotentikasi" },
        { status: 401 }
      );
    }

    const denied = staffMenuApiForbidden(user, request.nextUrl.pathname);
    if (denied) return denied;

    const params = await segmentData.params;
    if (!params.id) return NextResponse.json("Bad request", { status: 400 });

    if (
      user.role !== "Superadmin" &&
      user.id !== parseInt(params.id) &&
      user.parentId !== parseInt(params.id)
    )
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });

    const mitraUserId = parseInt(params.id, 10);
    const [routerRows, penagihRows] = await Promise.all([
      prisma.router.findMany({
        select: { id: true, nama: true, isolirProfileName: true, deleted: true },
        where: {
          userId: mitraUserId,
        },
        orderBy: { nama: "asc" },
      }),
      user.role === "Petugas"
        ? Promise.resolve([] as { id: number; nama: string; aktif: boolean }[])
        : prisma.penagih.findMany({
            where: { ownerUserId: mitraUserId },
            select: { id: true, nama: true, aktif: true },
            orderBy: [{ aktif: "desc" }, { nama: "asc" }],
          }),
    ]);
    const routerIds = routerRows.map((val) => val.id);
    const routerChoices = routerRows
      .filter((row) => !row.deleted)
      .map((row) => ({ id: row.id, nama: row.nama }));
    const penagihChoices = penagihRows.map((row) => ({
      id: row.id,
      nama: row.nama,
      aktif: row.aktif,
    }));
    const penagihIds = new Set(penagihRows.map((row) => row.id));
    const routerParam = parseInt(
      request.nextUrl.searchParams.get("router") || "",
      10
    );
    const routerFilterId = routerChoices.some((row) => row.id === routerParam)
      ? routerParam
      : null;

    const tahunParam = request.nextUrl.searchParams.get("tahun");
    const tahun = tahunParam ? parseInt(tahunParam) : new Date().getFullYear();
    const pageParam = request.nextUrl.searchParams.get("page");
    const page = Math.max(1, parseInt(pageParam || "1", 10) || 1);
    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = Math.min(
      100,
      Math.max(1, parseInt(limitParam || "50", 10) || 50)
    );
    const bulanParam = request.nextUrl.searchParams.get("bulan");
    const bulan =
      user.role === "Petugas" ? clampPetugasBulan(bulanParam) : bulanParam;
    const qRaw = request.nextUrl.searchParams.get("q")?.trim();
    const q = qRaw ? qRaw.slice(0, 200) : undefined; // cap length to avoid heavy LIKE abuse

    const bayarFilter = parsePelangganBayarFilter(
      request.nextUrl.searchParams.get("bayar")
    );
    const metodeFilter = parseMetodeBayarFilter(
      request.nextUrl.searchParams.get("metode")
    );
    const bankParam = request.nextUrl.searchParams.get("bank")?.trim().slice(0, 80) || null;
    const norekParam = request.nextUrl.searchParams.get("norek")?.trim().slice(0, 40) || null;
    const bankKosong = bankParam?.toLocaleLowerCase("id-ID") === "tanpa bank";
    const metodeEfektif = bankParam ? "Transfer" : metodeFilter;
    const bankWhere = !bankParam
      ? {}
      : bankKosong
        ? { bankId: null as number | null }
        : {
            bank: {
              is: {
                bank: bankParam,
                ...(norekParam ? { norek: norekParam } : {}),
              },
            },
          };
    const urutan = parsePelangganUrutan(
      request.nextUrl.searchParams.get("sort")
    );

    const isolirFilter = parseIsolirPelangganFilter(
      request.nextUrl.searchParams.get("isolir")
    );
    const penagihFilter = parsePenagihPelangganFilter(
      request.nextUrl.searchParams.get("penagih")
    );
    const inputterParam = parseInt(
      request.nextUrl.searchParams.get("inputter") || "",
      10
    );
    const inputterId =
      Number.isFinite(inputterParam) && inputterParam > 0
        ? inputterParam
        : null;
    const processedRange = jakartaProcessedDayRange(
      request.nextUrl.searchParams.get("processed")?.trim() ?? ""
    );
    const isolirWhere = pelangganIsolirFilterClause(isolirFilter, routerRows);
    const actorPenagih = await penagihScopeForActor(user);
    const penagihWhere =
      actorPenagih.where ??
      pelangganPenagihFilterClause(penagihFilter, penagihIds);
    const rekapPetugas = request.nextUrl.searchParams.get("rekap") === "petugas";

    // When bulan is provided, restrict pembayaran to that month only (avoids loading full year).
    let pembayaranDateGte: string;
    let pembayaranDateLte: string;
    if (bulan && /^\d{4}-\d{2}$/.test(bulan)) {
      const [y, m] = bulan.split("-").map(Number);
      pembayaranDateGte = new Date(y, m - 1, 1).toLocaleDateString("fr-CA");
      pembayaranDateLte = new Date(y, m, 0).toLocaleDateString("fr-CA");
    } else {
      // Default to current month when no bulan
      const now = new Date();
      pembayaranDateGte = new Date(
        now.getFullYear(),
        now.getMonth(),
        1
      ).toLocaleDateString("fr-CA");
      pembayaranDateLte = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0
      ).toLocaleDateString("fr-CA");
    }

    const jatuhTempoRange = {
      gte: pembayaranDateGte,
      lte: pembayaranDateLte,
    };
    const lunasKantorWhere = rekapPetugas
      ? pelangganLunasKantorWhere(
          jatuhTempoRange,
          await listUserIdProsesKantor(parseInt(params.id, 10))
        )
      : null;

    const pembayaranSomeClause: {
      jatuh_tempo: { gte: string; lte: string };
      status?: "Terbayar" | "Belum";
    } = (() => {
      if (bayarFilter === "terbayar") {
        return { jatuh_tempo: jatuhTempoRange, status: "Terbayar" };
      }
      if (bayarFilter === "belum") {
        return { jatuh_tempo: jatuhTempoRange, status: "Belum" };
      }
      return { jatuh_tempo: jatuhTempoRange };
    })();

    const staffPelangganWhere = await resolveStaffPelangganScopeWhere(
      user,
      parseInt(params.id, 10),
      request.nextUrl.searchParams.get("staff")
    );

    const scopeAnd: Prisma.PelangganWhereInput[] = [
      ...(inputterId
        ? [
            {
              pembayaran: {
                some: {
                  jatuh_tempo: jatuhTempoRange,
                  status: "Terbayar" as const,
                  OR: [
                    { inputterId },
                    {
                      inputterId: null,
                      log: {
                        some: {
                          status: "Terbayar" as const,
                          inputterId,
                        },
                      },
                    },
                  ],
                },
              },
            },
          ]
        : []),
      ...(processedRange
        ? [
            {
              pembayaran: {
                some: {
                  jatuh_tempo: jatuhTempoRange,
                  status: "Terbayar" as const,
                  OR: [
                    {
                      log: {
                        some: {
                          status: "Terbayar" as const,
                          created: processedRange,
                        },
                      },
                    },
                    {
                      updated: processedRange,
                      log: { none: { status: "Terbayar" as const } },
                    },
                  ],
                },
              },
            },
          ]
        : []),
      ...(penagihWhere ? [penagihWhere] : []),
      ...(lunasKantorWhere ? [{ NOT: lunasKantorWhere }] : []),
      ...(metodeEfektif
        ? [
            {
              pembayaran: {
                some: {
                  jatuh_tempo: jatuhTempoRange,
                  status: "Terbayar" as const,
                  metode: metodeEfektif,
                  ...bankWhere,
                },
              },
            },
          ]
        : []),
    ];

    const baseWhereWithoutBayar: Prisma.PelangganWhereInput = {
      routerId: routerFilterId ?? { in: routerIds },
      ...pelangganUntukPenagihanWhere,
      ...staffPelangganWhere,
      ...(isolirWhere ?? {}),
      ...(scopeAnd.length > 0 ? { AND: scopeAnd } : {}),
      ...(q
        ? {
            OR: [
              { nama: { contains: q } },
              { email: { contains: q } },
              { nomor: { contains: q } },
              { router: { nama: { contains: q } } },
              { ppp_secret: { name: { contains: q } } },
            ],
          }
        : {}),
    };

    const baseWhere: Prisma.PelangganWhereInput = {
      ...baseWhereWithoutBayar,
      ...(isTagihanStatusBayarFilter(bayarFilter)
        ? { pembayaran: { some: pembayaranSomeClause } }
        : {}),
      ...(bayarFilter === "tagihan" &&
      bulan &&
      /^\d{4}-\d{2}$/.test(bulan)
        ? { pembayaran: { some: { jatuh_tempo: jatuhTempoRange } } }
        : {}),
      ...(bayarFilter === "berhenti" || bayarFilter === "gratis"
        ? pelangganKategoriBayarWhere(bayarFilter, jatuhTempoRange)
        : {}),
    };

    const dayScope = {
      routerIds: routerFilterId ? [routerFilterId] : routerIds,
      jatuhTempo: jatuhTempoRange,
      pelangganWhere: staffPelangganWhere,
    };
    const [inputterRows, processedDayRows] = hidesMitraDirectory(user.role)
      ? [[], []]
      : await Promise.all([
          listPembayaranInputtersForRange(dayScope),
          listPembayaranProcessedDaysForRange(dayScope),
        ]);
    const inputterOptions = valuesForAudience(user.role, inputterRows);
    const processedDays = valuesForAudience(user.role, processedDayRows);
    const routers = valuesForAudience(user.role, routerChoices);

    const pembayaranWhere = {
      jatuh_tempo: jatuhTempoRange,
      ...(bayarFilter === "belum" ? { status: "Belum" as const } : {}),
      ...(bayarFilter === "terbayar" || metodeEfektif
        ? { status: "Terbayar" as const }
        : {}),
      ...(metodeEfektif ? { metode: metodeEfektif } : {}),
      ...bankWhere,
    };

    const pelangganInclude = {
      pembayaran: {
        where: pembayaranWhere,
        include: {
          bank: { select: { bank: true } },
        },
      },
      ppp_secret: {
        select: {
          name: true,
          profile: true,
          disabled: true,
          isIsolir: true,
          profileBeforeIsolir: true,
          on_router: true,
        },
      },
      router: { select: { id: true, nama: true, isolirProfileName: true } },
      paket: { select: { id: true, harga: true, nama: true } },
      penagihPenugasan: {
        select: {
          penagih: { select: { nama: true, aktif: true } },
        },
      },
    } satisfies Prisma.PelangganInclude;

    let total: number;
    let pelanggan: Prisma.PelangganGetPayload<{
      include: typeof pelangganInclude;
    }>[];
    let totalPages: number;

    const [mitraUserRow, autoIsolirSettings, ppnPolicy] = await Promise.all([
      prisma.user.findUnique({
        where: { id: mitraUserId },
        select: {
          ppn: true,
          billingStartMode: true,
          billingStartDate: true,
          ownedByIsp: true,
        },
      }),
      prisma.autoIsolirSettings.findUnique({
        where: { userId: mitraUserId },
        select: { enabled: true },
      }),
      resolveMitraPpnPolicy(mitraUserId),
    ]);

    const pelangganListExtras = {
      mitraPpn: ppnPolicy.ppnEnabled ? ppnPolicy.ppnPercent : null,
      ppnEnabled: ppnPolicy.ppnEnabled,
      autoIsolirEnabled: autoIsolirSettings?.enabled === true,
    };

    const loadWindow = async (where: Prisma.PelangganWhereInput) => {
      if (!urutan) {
        const count = await prisma.pelanggan.count({ where });
        const rows = await prisma.pelanggan.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { nama: "asc" },
          include: pelangganInclude,
        });
        return {
          total: count,
          pelanggan: rows,
          totalPages: Math.ceil(count / limit) || 1,
        };
      }
      const all = await prisma.pelanggan.findMany({
        where,
        select: { id: true },
        orderBy: { nama: "asc" },
      });
      const ids = all.map((row) => row.id);
      const ordered =
        urutan === "belum"
          ? await sortPelangganIdsBelumDulu(ids, jatuhTempoRange)
          : await sortPelangganIdsByDiproses(ids, jatuhTempoRange, urutan);
      const count = ordered.length;
      const pageIds = ordered.slice((page - 1) * limit, page * limit);
      const rows =
        pageIds.length === 0
          ? []
          : await prisma.pelanggan.findMany({
              where: { id: { in: pageIds } },
              include: pelangganInclude,
            });
      const byId = new Map(rows.map((row) => [row.id, row]));
      return {
        total: count,
        pelanggan: pageIds.flatMap((id) => {
          const row = byId.get(id);
          return row ? [row] : [];
        }),
        totalPages: Math.ceil(count / limit) || 1,
      };
    };

    if (
      bayarFilter === "belum_waktunya" &&
      bulan &&
      /^\d{4}-\d{2}$/.test(bulan)
    ) {
      const result = await listPelangganBelumWaktunyaPaginated({
        baseWhere: baseWhereWithoutBayar,
        jatuhTempoRange,
        billingPeriod: bulan,
        billingStartMode: mitraUserRow?.billingStartMode ?? "NEXT_MONTH",
        billingStartDate: mitraUserRow?.billingStartDate ?? null,
        ownedByIsp: mitraUserRow?.ownedByIsp === true,
        sort: urutan,
        page,
        limit,
        include: pelangganInclude,
      });
      total = result.total;
      pelanggan = result.pelanggan;
      totalPages = result.totalPages;
    } else if (
      bayarFilter === "tidak_terbayar" &&
      bulan &&
      /^\d{4}-\d{2}$/.test(bulan)
    ) {
      const result = await listPelangganTidakTerbayarPaginated({
        baseWhere: baseWhereWithoutBayar,
        jatuhTempoRange,
        sort: urutan,
        page,
        limit,
        include: pelangganInclude,
      });
      total = result.total;
      pelanggan = result.pelanggan;
      totalPages = result.totalPages;
    } else if (
      bayarFilter === "tanpa_tagihan" &&
      bulan &&
      /^\d{4}-\d{2}$/.test(bulan)
    ) {
      const result = await listPelangganTanpaTagihanPaginated({
        baseWhere: baseWhereWithoutBayar,
        jatuhTempoRange,
        billingPeriod: bulan,
        billingStartMode: mitraUserRow?.billingStartMode ?? "NEXT_MONTH",
        billingStartDate: mitraUserRow?.billingStartDate ?? null,
        ownedByIsp: mitraUserRow?.ownedByIsp === true,
        sort: urutan,
        page,
        limit,
        include: pelangganInclude,
      });
      total = result.total;
      pelanggan = result.pelanggan;
      totalPages = result.totalPages;
    } else if (
      bayarFilter === "semua" &&
      bulan &&
      /^\d{4}-\d{2}$/.test(bulan)
    ) {
      const result = await listPelangganSemuaBulanPaginated({
        baseWhere: baseWhereWithoutBayar,
        jatuhTempoRange,
        billingPeriod: bulan,
        billingStartMode: mitraUserRow?.billingStartMode ?? "NEXT_MONTH",
        billingStartDate: mitraUserRow?.billingStartDate ?? null,
        ownedByIsp: mitraUserRow?.ownedByIsp === true,
        sort: urutan,
        page,
        limit,
        include: pelangganInclude,
      });
      total = result.total;
      pelanggan = result.pelanggan;
      totalPages = result.totalPages;
    } else if (bayarFilter === "belum_input") {
      const result =
        actorPenagih.where != null ||
        penagihFilter.kind === "id" ||
        penagihFilter.kind === "ada"
          ? { total: 0, rows: [], totalPages: 1 }
          : await listPppBelumInputPaginated({
              mitraUserId,
              page,
              limit,
              q,
              routerId: routerFilterId,
            });
      total = result.total;
      pelanggan = [];
      totalPages = result.totalPages;
      return NextResponse.json({
        data: [],
        pppBelumInput: result.rows,
        pagination: { total, page, limit, totalPages },
        mitraBillingStartMode: mitraUserRow?.billingStartMode ?? "NEXT_MONTH",
        mitraOwnedByIsp: mitraUserRow?.ownedByIsp === true,
        mitraBillingStartDate: mitraUserRow?.billingStartDate ?? null,
        billingPeriod:
          bulan && /^\d{4}-\d{2}$/.test(bulan) ? bulan : undefined,
        ...pelangganListExtrasForAudience(user.role, pelangganListExtras),
        inputterOptions,
        processedDays,
        routers,
        penagih: penagihChoices,
        penagihLock: actorPenagih.lock,
        message: "Berhasil mendapatkan data PPP belum input",
      });
    } else if (bayarFilter === "total") {
      const window = await loadWindow(baseWhereWithoutBayar);
      total = window.total;
      pelanggan = window.pelanggan;
      totalPages = window.totalPages;
    } else {
      const window = await loadWindow(baseWhere);
      total = window.total;
      pelanggan = window.pelanggan;
      totalPages = window.totalPages;
    }

    const data = pelanggan.map((pel) => ({
      ...pel,
      ppp_secret: pppSecretForAudience(user.role, pel.ppp_secret),
      isolirOleh: null as string | null,
      isolirAt: null as string | null,
      bukaIsolirOleh: null as string | null,
      bukaIsolirAt: null as string | null,
      berhentiOleh: null as string | null,
      berhentiAt: null as string | null,
      lanjutOleh: null as string | null,
      lanjutAt: null as string | null,
    }));

    if (data.length > 0) {
      const allPembayaran = data.flatMap((p) => p.pembayaran);
      if (allPembayaran.length > 0) {
        const enriched = await enrichPembayaranWithInputters(allPembayaran, {
          audienceRole: user.role,
        });
        const byId = new Map(enriched.map((p) => [p.id, p]));
        for (const pel of data) {
          pel.pembayaran = pel.pembayaran.map((p) => byId.get(p.id)!);
        }
      }
      const pelangganIds = data.map((p) => p.id);
      const [actors, bukaActors, berhentiActors, lanjutActors] =
        await Promise.all([
          latestIsolirActorByPelanggan(pelangganIds),
          latestBukaIsolirByPelanggan(pelangganIds, bulan),
          latestBerhentiByPelanggan(pelangganIds),
          latestLanjutByPelanggan(pelangganIds),
        ]);
      for (const pel of data) {
        const actor = actors.get(pel.id);
        pel.isolirAt = actor?.created.toISOString() ?? null;
        const buka = bukaActors.get(pel.id);
        pel.bukaIsolirAt = buka?.created.toISOString() ?? null;
        const berhenti = berhentiActors.get(pel.id);
        pel.berhentiAt = berhenti?.created.toISOString() ?? null;
        const lanjut = lanjutActors.get(pel.id);
        pel.lanjutAt = lanjut?.created.toISOString() ?? null;
        const visibleActors = statusActorsForAudience(user.role, {
          isolirOleh: actor?.executedBy ?? null,
          bukaIsolirOleh: buka?.executedBy ?? null,
          berhentiOleh: berhenti?.executedBy ?? null,
          lanjutOleh: lanjut?.executedBy ?? null,
        });
        pel.isolirOleh = visibleActors.isolirOleh;
        pel.bukaIsolirOleh = visibleActors.bukaIsolirOleh;
        pel.berhentiOleh = visibleActors.berhentiOleh;
        pel.lanjutOleh = visibleActors.lanjutOleh;
      }
    }

    const billingPeriod =
      bulan && /^\d{4}-\d{2}$/.test(bulan) ? bulan : undefined;

    return NextResponse.json({
      data,
      pppBelumInput: null,
      pagination: { total, page, limit, totalPages },
      mitraBillingStartMode: mitraUserRow?.billingStartMode ?? "NEXT_MONTH",
      mitraOwnedByIsp: mitraUserRow?.ownedByIsp === true,
      mitraBillingStartDate: mitraUserRow?.billingStartDate ?? null,
      billingPeriod,
      ...pelangganListExtrasForAudience(user.role, pelangganListExtras),
      inputterOptions,
      processedDays,
      routers,
      penagih: penagihChoices,
      penagihLock: actorPenagih.lock,
      message: "Berhasil mendapatkan data pendapatan user",
    });
  } catch (err) {
    const error = err as Error;
    logger.error({
      msg: "GET pembayaran/pelanggan/[id] error",
      error: error.message,
    });
    return NextResponse.json(error.message, { status: 400 });
  }
}
