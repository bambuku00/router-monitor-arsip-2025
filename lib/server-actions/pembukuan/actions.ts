"use server";

import { validateRequest } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { sumMitraTagihanKantorForBulan } from "@/lib/pembayaran-mitra-rekapan";
import prisma from "@/lib/prisma";
import { getOwnedResourcesUserId } from "@/lib/rbac";
import {
  canAccessPembukuan,
  isMitraStaff,
  usesKantorPembukuanView,
} from "@/lib/pembukuan-scope";
import { summarizeRouterIncome } from "@/lib/pembukuan-router";
import {
  enrichPembayaranWithInputters,
  formatPembayaranProcessedAt,
  formatPembayaranProcessorLabel,
  jakartaCalendarParts,
} from "@/lib/pembayaran-inputter";
import {
  filterCashRows,
  filterTransferRows,
  paginateTransferRows,
  summarizeCashOrang,
  sortTransferRows,
  summarizeTransfers,
  transferBankLabel,
  transferProcessedDays,
  transferProcessorOptions,
  type LabeledPembukuanTransfer,
} from "@/lib/pembukuan-transfer";
import {
  hapusKomisiTagihanTidakLunas,
  rekapKomisiPengeluaran,
} from "@/lib/komisi-petugas";
import { Prisma } from "@prisma/client";

async function resolvePembukuanScope(requestedMitraId?: number) {
  const { user } = await validateRequest();
  if (!user || !canAccessPembukuan(user)) {
    return { error: "Unauthorized" as const };
  }

  let mitraId = requestedMitraId;
  // Admin & staff mitra: scope ke pemilik resource. Keuangan kantor: scope sendiri.
  if (user.role === "Admin" || isMitraStaff(user)) {
    mitraId = getOwnedResourcesUserId(user);
  } else if (user.role === "Keuangan") {
    const owner = getOwnedResourcesUserId(user);
    if (mitraId !== undefined && mitraId !== owner) {
      return { error: "Unauthorized" as const };
    }
    mitraId = owner;
  } else if (user.role === "Teknisi") {
    return { error: "Unauthorized" as const };
  }

  return {
    user,
    mitraId,
    kantor: usesKantorPembukuanView(user),
  };
}

async function resolveOwnedRouterId(
  mitraId: number | undefined,
  routerId?: number
) {
  if (routerId == null) return { routerId: undefined as number | undefined };
  if (!Number.isInteger(routerId) || routerId <= 0) {
    return { error: "Unauthorized" as const };
  }
  const router = await prisma.router.findFirst({
    where: {
      id: routerId,
      ...(mitraId ? { userId: mitraId } : {}),
    },
    select: { id: true },
  });
  if (!router) return { error: "Unauthorized" as const };
  return { routerId: router.id };
}

export async function getPembukuanStats(
  year: number,
  month?: number,
  mitraId?: number,
  routerId?: number
) {
  const scope = await resolvePembukuanScope(mitraId);
  if ("error" in scope) return { error: scope.error };
  const { user } = scope;
  mitraId = scope.mitraId;
  const ownedRouter = scope.kantor
    ? { routerId: undefined }
    : await resolveOwnedRouterId(mitraId, routerId);
  if ("error" in ownedRouter) return { error: ownedRouter.error };
  routerId = ownedRouter.routerId;

  try {
    // 3. Expenses for the selected period
    const filterPrefix = month 
        ? `${year}-${month.toString().padStart(2, "0")}`
        : `${year}`;

    // Jika dashboard global (mitraId kosong): hanya Superadmin — pengeluaran ops terikat user login.
    const expenseUserId = mitraId ? mitraId : user.role === "Superadmin" ? user.id : undefined;

    let expenseWhere: Prisma.PengeluaranWhereInput = {
        tanggal: {
            gte: new Date(year, 0, 1),
            lt: new Date(year + 1, 0, 1)
        }
    };
    
    if (expenseUserId) {
        expenseWhere.userId = expenseUserId;
    }

    if (month) {
        // Merge month filter carefully so we don't overwrite userId
        expenseWhere.tanggal = {
            gte: new Date(year, month - 1, 1),
            lt: new Date(year, month, 1)
        };
    }

    const periodExpensesAgg = await prisma.pengeluaran.aggregate({
        _sum: { nominal: true },
        where: expenseWhere
    });

    const komisiWhere: Prisma.KomisiPetugasEntriWhereInput = {
        created: month
            ? { gte: new Date(year, month - 1, 1), lt: new Date(year, month, 1) }
            : { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) },
        ...(expenseUserId ? { ownerUserId: expenseUserId } : {}),
    };
    await hapusKomisiTagihanTidakLunas(prisma);
    const komisiRows = await prisma.komisiPetugasEntri.findMany({
        where: komisiWhere,
        select: { nominal: true, created: true },
    });
    const komisiRekap = rekapKomisiPengeluaran(komisiRows);
    const periodKomisi = komisiRekap.total;
    const periodExpenses = (periodExpensesAgg._sum.nominal || 0) + periodKomisi;

    const expenses = await prisma.pengeluaran.findMany({
        where: expenseWhere
    });

    // 3b. Expenses This/Last Month
    const today = new Date();
    const currentMonthStr = today.toISOString().slice(0, 7); // YYYY-MM
    
    const lastMonthDate = new Date();
    lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
    const lastMonthStr = lastMonthDate.toISOString().slice(0, 7);

    const getMonthRange = (date: Date) => {
        const y = date.getFullYear();
        const m = date.getMonth();
        return {
            start: new Date(y, m, 1),
            end: new Date(y, m + 1, 1)
        };
    };

    const thisMonthRange = getMonthRange(today);
    const lastMonthRange = getMonthRange(lastMonthDate);

    const expenseUserIdFilter = expenseWhere.userId ? { userId: expenseWhere.userId } : {};

    const thisMonthExpensesAgg = await prisma.pengeluaran.aggregate({
        _sum: { nominal: true },
        where: {
            tanggal: {
                gte: thisMonthRange.start,
                lt: thisMonthRange.end
            },
            ...expenseUserIdFilter
        }
    });
    const thisMonthKomisiAgg = await prisma.komisiPetugasEntri.aggregate({
        _sum: { nominal: true },
        where: {
            created: { gte: thisMonthRange.start, lt: thisMonthRange.end },
            ...(expenseUserId ? { ownerUserId: expenseUserId } : {}),
        },
    });

    const lastMonthExpensesAgg = await prisma.pengeluaran.aggregate({
        _sum: { nominal: true },
        where: {
            tanggal: {
                gte: lastMonthRange.start,
                lt: lastMonthRange.end
            },
            ...expenseUserIdFilter
        }
    });
    const lastMonthKomisiAgg = await prisma.komisiPetugasEntri.aggregate({
        _sum: { nominal: true },
        where: {
            created: { gte: lastMonthRange.start, lt: lastMonthRange.end },
            ...(expenseUserId ? { ownerUserId: expenseUserId } : {}),
        },
    });

    let periodUnpaid = 0;
    let periodRevenue = 0;
    const monthlyRevenue = new Array(12).fill(0);
    const dailyRevenue = new Array(31).fill(0);
    const monthlyExpenses = new Array(12).fill(0);
    const dailyExpenses = new Array(31).fill(0);
    let recentTransactions: unknown[] = [];
    let thisMonthRevenueVal = 0;
    let lastMonthRevenueVal = 0;
    let thisMonthUnpaidVal = 0;
    let cashTotal = 0;
    let transferTotal = 0;
    let periodRevenueAll = 0;
    let routerIncome: {
      id: number;
      nama: string;
      diterima: number;
      belum: number;
    }[] = [];

    // Process Expenses (Shared)
    expenses.forEach((e) => {
                const mIndex = e.tanggal.getMonth();
                const dIndex = e.tanggal.getDate() - 1;
                if (mIndex >= 0 && mIndex < 12) monthlyExpenses[mIndex] += e.nominal;
                if (dIndex >= 0 && dIndex < 31) dailyExpenses[dIndex] += e.nominal;
            });
    komisiRekap.monthly.forEach((nominal, index) => {
        monthlyExpenses[index] += nominal;
    });
    komisiRekap.daily.forEach((nominal, index) => {
        dailyExpenses[index] += nominal;
    });

            if (usesKantorPembukuanView(user)) {
                const dateFilter: Record<string, unknown> = {};
        if (month) {
            dateFilter.tanggal = `${year}-${month.toString().padStart(2, "0")}`;
        } else {
            dateFilter.tanggal = { startsWith: `${year}` };
        }

        const mitraWhere: Prisma.PembayaranMitraWhereInput = {};
        if (mitraId) {
            mitraWhere.userId = mitraId;
        }

        // Calculate Total Obligation (What Mitras owe) — hormati revenueBasis per mitra
        let totalObligation = 0;
        if (month) {
          const bulan = `${year}-${month.toString().padStart(2, "0")}`;
          totalObligation = await sumMitraTagihanKantorForBulan(bulan, mitraId);
        } else {
          for (let m = 1; m <= 12; m++) {
            const bulan = `${year}-${m.toString().padStart(2, "0")}`;
            totalObligation += await sumMitraTagihanKantorForBulan(
              bulan,
              mitraId
            );
          }
        }

        // 3. Calculate Total Paid by Mitras (Revenue)
        const revenueAgg = await prisma.pembayaranMitra.aggregate({
            _sum: { paid: true },
            where: {
                ...mitraWhere,
                status: "Terbayar",
                tanggal: { startsWith: filterPrefix }
            }
        });
        periodRevenue = revenueAgg._sum.paid || 0;
        periodRevenueAll = periodRevenue;

        // Calculate Payment Methods for Superadmin
        const paymentMethodRecords = await prisma.pembayaranMitra.findMany({
            where: {
                ...mitraWhere,
                status: "Terbayar",
                tanggal: { startsWith: filterPrefix }
            },
            select: {
                paid: true,
                metode: true
            }
        });

        paymentMethodRecords.forEach(p => {
             if (p.metode === "Cash") cashTotal += p.paid;
             if (p.metode === "Transfer") transferTotal += p.paid;
        });

        // 4. Calculate Unpaid (Obligation - Paid)
        // Note: We also need to account for partial payments in PembayaranMitra (even if not 'Terbayar')
        const totalPaidAgg = await prisma.pembayaranMitra.aggregate({
            _sum: { paid: true },
            where: {
                ...mitraWhere,
                tanggal: { startsWith: filterPrefix }
            }
        });
        const totalPaidAnyStatus = totalPaidAgg._sum.paid || 0;
        
        periodUnpaid = Math.max(0, totalObligation - totalPaidAnyStatus);

        // Monthly Graph Data (Fetch all paid for the year)
        const yearRevenueRecords = await prisma.pembayaranMitra.findMany({
            where: {
                ...mitraWhere,
                status: "Terbayar",
                tanggal: { startsWith: `${year}` }
            },
            select: {
                paid: true,
                tanggal: true
            }
        });

        yearRevenueRecords.forEach(r => {
            const parts = r.tanggal.split("-");
            if (parts.length >= 2) {
                const m = parseInt(parts[1]) - 1;
                if (m >= 0 && m < 12) {
                    monthlyRevenue[m] += r.paid;
                }
            }
        });

        // This Month / Last Month logic
        // For simplified dashboard, we might want to just show Realized Revenue
        const thisMonthAgg = await prisma.pembayaranMitra.aggregate({
            _sum: { paid: true },
            where: { 
                ...mitraWhere,
                status: "Terbayar", 
                tanggal: currentMonthStr 
            }
        });
        thisMonthRevenueVal = thisMonthAgg._sum.paid || 0;

        const lastMonthAgg = await prisma.pembayaranMitra.aggregate({
            _sum: { paid: true },
            where: { 
                ...mitraWhere,
                status: "Terbayar", 
                tanggal: lastMonthStr 
            }
        });
        lastMonthRevenueVal = lastMonthAgg._sum.paid || 0;

        // For "This Month Unpaid", replicate logic for this month to be consistent.
         
         const thisMonthObligation = await sumMitraTagihanKantorForBulan(
           currentMonthStr,
           mitraId
         );
         thisMonthUnpaidVal = Math.max(0, thisMonthObligation - thisMonthRevenueVal);

        const recent = await prisma.pembayaranMitra.findMany({
            where: { 
                ...mitraWhere,
                status: "Terbayar" 
            },
            orderBy: { updated: "desc" },
            take: 5,
            include: { user: { select: { nama: true } } }
        });
        recentTransactions = recent.map(r => ({
            ...r,
            pelanggan: r.user // Map user to pelanggan for potential frontend compatibility
        }));

    } else {
        // --- EXISTING LOGIC (Pembayaran Client) ---

        const ownerPelanggan: Prisma.PelangganWhereInput = mitraId
          ? { router: { userId: mitraId } }
          : {};
        const baseWhere: Prisma.PembayaranWhereInput = {
          pelanggan: {
            ...ownerPelanggan,
            ...(routerId ? { routerId } : {}),
          },
        };

        const [periodBills, routers] = await Promise.all([
          prisma.pembayaran.findMany({
            where: {
              pelanggan: ownerPelanggan,
              jatuh_tempo: { startsWith: filterPrefix },
              status: { in: ["Terbayar", "Belum"] },
            },
            select: {
              total: true,
              status: true,
              metode: true,
              jatuh_tempo: true,
              pelanggan: {
                select: {
                  routerId: true,
                  router: { select: { nama: true } },
                },
              },
            },
          }),
          prisma.router.findMany({
            where: {
              deleted: false,
              ...(mitraId ? { userId: mitraId } : {}),
            },
            select: { id: true, nama: true },
          }),
        ]);

        routerIncome = summarizeRouterIncome(
          periodBills.map((bill) => ({
            routerId: bill.pelanggan.routerId,
            routerNama: bill.pelanggan.router.nama,
            status: bill.status,
            nominal: bill.total,
          })),
          routers
        );

        const scopedBills = routerId
          ? periodBills.filter((bill) => bill.pelanggan.routerId === routerId)
          : periodBills;
        for (const bill of periodBills) {
          if (bill.status === "Terbayar") periodRevenueAll += bill.total;
        }
        for (const bill of scopedBills) {
          if (bill.status === "Belum") periodUnpaid += bill.total;
          if (bill.status !== "Terbayar") continue;
          periodRevenue += bill.total;
          const parts = bill.jatuh_tempo.split("-");
          const mIndex = parseInt(parts[1]) - 1;
          const dIndex = parseInt(parts[2]) - 1;
          if (mIndex >= 0 && mIndex < 12) monthlyRevenue[mIndex] += bill.total;
          if (dIndex >= 0 && dIndex < 31) dailyRevenue[dIndex] += bill.total;
          if (bill.metode === "Cash") cashTotal += bill.total;
          if (bill.metode === "Transfer") transferTotal += bill.total;
        }

        // 3. This Month vs Last Month (harus scoped ke mitra yang sama)
        const thisMonthRevAgg = await prisma.pembayaran.aggregate({
            _sum: { total: true },
            where: {
                ...baseWhere,
                status: "Terbayar",
                jatuh_tempo: { startsWith: currentMonthStr }
            }
        });
        thisMonthRevenueVal = thisMonthRevAgg._sum.total || 0;

        const thisMonthUnpaidAgg = await prisma.pembayaran.aggregate({
            _sum: { total: true },
            where: {
                ...baseWhere,
                status: "Belum",
                jatuh_tempo: { startsWith: currentMonthStr }
            }
        });
        thisMonthUnpaidVal = thisMonthUnpaidAgg._sum.total || 0;

        const lastMonthRevAgg = await prisma.pembayaran.aggregate({
            _sum: { total: true },
            where: {
                ...baseWhere,
                status: "Terbayar",
                jatuh_tempo: { startsWith: lastMonthStr }
            }
        });
        lastMonthRevenueVal = lastMonthRevAgg._sum.total || 0;

        // 4. Recent Transactions
        recentTransactions = await prisma.pembayaran.findMany({
            where: { ...baseWhere, status: "Terbayar" },
            orderBy: { updated: "desc" },
            take: 5,
            include: {
                pelanggan: {
                    select: { nama: true }
                }
            }
        });
    }

    return {
      data: {
        periodRevenue,
        periodRevenueAll,
        periodExpenses,
        periodKomisi,
        periodUnpaid,
        monthlyRevenue,
        dailyRevenue,
        monthlyExpenses,
        dailyExpenses,
        paymentMethods: {
            cash: cashTotal,
            transfer: transferTotal
        },
        thisMonth: (thisMonthRevenueVal || 0) + (thisMonthUnpaidVal || 0),
        lastMonth: lastMonthRevenueVal || 0,
        thisMonthExpenses:
          (thisMonthExpensesAgg._sum.nominal || 0) + (thisMonthKomisiAgg._sum.nominal || 0),
        lastMonthExpenses:
          (lastMonthExpensesAgg._sum.nominal || 0) + (lastMonthKomisiAgg._sum.nominal || 0),
        recentTransactions,
        routerIncome,
      },
    };
  } catch (err) {
    const error = err as Error;
    logger.error({ msg: "Error fetching pembukuan stats", error: error.message });
    return { error: "Terjadi kesalahan pada server" };
  }
}

const TRANSFER_PAGE_SIZES = [10, 20, 50] as const;

export async function getPembukuanTransfers(input: {
  year: number;
  month?: number;
  mitraId?: number;
  routerId?: number;
  page?: number;
  pageSize?: number;
  query?: string;
  bank?: string;
  processor?: string;
  day?: number;
  sort?: "nama" | "tanggal" | null;
}) {
  const scope = await resolvePembukuanScope(input.mitraId);
  if ("error" in scope) return { error: scope.error };
  const ownedRouter = scope.kantor
    ? { routerId: undefined }
    : await resolveOwnedRouterId(scope.mitraId, input.routerId);
  if ("error" in ownedRouter) return { error: ownedRouter.error };

  const year = input.year;
  const month = input.month;
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return { error: "Periode tidak valid" };
  }
  if (month != null && (!Number.isInteger(month) || month < 1 || month > 12)) {
    return { error: "Periode tidak valid" };
  }

  const pageSize = TRANSFER_PAGE_SIZES.includes(
    input.pageSize as (typeof TRANSFER_PAGE_SIZES)[number]
  )
    ? (input.pageSize as (typeof TRANSFER_PAGE_SIZES)[number])
    : 10;
  const page = Number.isInteger(input.page) && (input.page ?? 0) > 0 ? input.page! : 1;
  const query = (input.query ?? "").trim().slice(0, 80);
  const bank = (input.bank ?? "").trim().slice(0, 80);
  const sort = input.sort === "nama" || input.sort === "tanggal" ? input.sort : null;
  const filterPrefix = month
    ? `${year}-${month.toString().padStart(2, "0")}`
    : `${year}`;

  try {
    const labeled = scope.kantor
      ? await listKantorTransfers(scope.mitraId, filterPrefix, year, month)
      : await listPelangganTransfers(
          scope.mitraId,
          filterPrefix,
          ownedRouter.routerId,
          year,
          month
        );
    const summary = summarizeTransfers(labeled);
    const optionRows = filterTransferRows(labeled, "", bank);
    const sorted = sortTransferRows(filterTransferRows(labeled, query, bank), sort);
    const pageResult = paginateTransferRows(sorted, page, pageSize);
    const sourceById = new Map(sorted.map((row) => [row.id, row]));
    const rows = pageResult.rows.map((row) => {
      const source = sourceById.get(row.id);
      return {
        ...row,
        pemroses: source?.pemroses?.trim() || "—",
        diprosesPada: source?.diprosesPada ?? null,
      };
    });
    return {
      data: {
        banks: summary.banks,
        jumlah: summary.jumlah,
        pembayar: summary.pembayar,
        pelangganView: !scope.kantor,
        processorOptions: transferProcessorOptions(optionRows),
        processedDays: transferProcessedDays(optionRows),
        rows,
        total: pageResult.total,
        page: pageResult.page,
        totalPages: pageResult.totalPages,
      },
    };
  } catch (err) {
    const error = err as Error;
    logger.error({
      msg: "Error fetching pembukuan transfers",
      error: error.message,
    });
    return { error: "Terjadi kesalahan pada server" };
  }
}

export async function getPembukuanCash(input: {
  year: number;
  month?: number;
  mitraId?: number;
  routerId?: number;
  page?: number;
  pageSize?: number;
  query?: string;
  pelaku?: string;
  sort?: "nama" | "tanggal" | null;
}) {
  const scope = await resolvePembukuanScope(input.mitraId);
  if ("error" in scope) return { error: scope.error };
  const ownedRouter = scope.kantor
    ? { routerId: undefined }
    : await resolveOwnedRouterId(scope.mitraId, input.routerId);
  if ("error" in ownedRouter) return { error: ownedRouter.error };

  const year = input.year;
  const month = input.month;
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return { error: "Periode tidak valid" };
  }
  if (month != null && (!Number.isInteger(month) || month < 1 || month > 12)) {
    return { error: "Periode tidak valid" };
  }

  const pageSize = TRANSFER_PAGE_SIZES.includes(
    input.pageSize as (typeof TRANSFER_PAGE_SIZES)[number]
  )
    ? (input.pageSize as (typeof TRANSFER_PAGE_SIZES)[number])
    : 10;
  const page = Number.isInteger(input.page) && (input.page ?? 0) > 0 ? input.page! : 1;
  const query = (input.query ?? "").trim().slice(0, 80);
  const pelaku = (input.pelaku ?? "").trim().slice(0, 80);
  const sort = input.sort === "nama" || input.sort === "tanggal" ? input.sort : null;
  const filterPrefix = month
    ? `${year}-${month.toString().padStart(2, "0")}`
    : `${year}`;

  try {
    const labeled = scope.kantor
      ? await listKantorTransfers(scope.mitraId, filterPrefix, year, month, "Cash")
      : await listPelangganTransfers(
          scope.mitraId,
          filterPrefix,
          ownedRouter.routerId,
          year,
          month,
          "Cash"
        );
    const summary = summarizeCashOrang(labeled);
    const sorted = sortTransferRows(filterCashRows(labeled, query, pelaku), sort);
    const pageResult = paginateTransferRows(sorted, page, pageSize);
    const sourceById = new Map(sorted.map((row) => [row.id, row]));
    const rows = pageResult.rows.map((row) => {
      const source = sourceById.get(row.id);
      return {
        ...row,
        pemroses: source?.pemroses?.trim() || "—",
        diprosesPada: source?.diprosesPada ?? null,
      };
    });
    return {
      data: {
        orang: summary.orang,
        jumlah: summary.jumlah,
        totalNominal: summary.total,
        pelangganView: !scope.kantor,
        rows,
        total: pageResult.total,
        page: pageResult.page,
        totalPages: pageResult.totalPages,
      },
    };
  } catch (err) {
    const error = err as Error;
    logger.error({
      msg: "Error fetching pembukuan cash",
      error: error.message,
    });
    return { error: "Terjadi kesalahan pada server" };
  }
}

function processedDayInPeriod(
  at: Date | string | null | undefined,
  year: number,
  month?: number
): number | null {
  if (!at) return null;
  const calendar = jakartaCalendarParts(new Date(at));
  if (!calendar || calendar.year !== year) return null;
  if (month != null && calendar.month !== month) return null;
  return calendar.day;
}

async function listPelangganTransfers(
  mitraId: number | undefined,
  filterPrefix: string,
  routerId: number | undefined,
  year: number,
  month?: number,
  metode: "Cash" | "Transfer" = "Transfer"
): Promise<LabeledPembukuanTransfer[]> {
  const rows = await prisma.pembayaran.findMany({
    where: {
      status: "Terbayar",
      metode,
      jatuh_tempo: { startsWith: filterPrefix },
      pelanggan: {
        ...(routerId ? { routerId } : {}),
        ...(mitraId ? { router: { userId: mitraId } } : {}),
      },
    },
    select: {
      id: true,
      total: true,
      jatuh_tempo: true,
      pelangganId: true,
      inputterId: true,
      updated: true,
      pelanggan: {
        select: {
          nama: true,
          ppp_secret: { select: { name: true } },
        },
      },
      bank: { select: { bank: true, norek: true } },
      tripayTransaksi: {
        where: { status: "PAID" },
        select: { id: true },
        take: 1,
      },
    },
  });

  const enriched = await enrichPembayaranWithInputters(
    rows.map((row) => ({
      id: row.id,
      status: "Terbayar" as const,
      inputterId: row.inputterId,
      updated: row.updated,
    }))
  );
  const processorById = new Map(enriched.map((row) => [row.id, row]));

  return rows.map((row) => {
    const processor = processorById.get(row.id);
    return {
      id: row.id,
      pembayarKey: `p:${row.pelangganId}`,
      nama: row.pelanggan.nama,
      pppoe: row.pelanggan.ppp_secret?.name?.trim() || "—",
      bank:
        metode === "Cash"
          ? "Cash"
          : transferBankLabel({
              bankName: row.bank?.bank,
              norek: row.bank?.norek,
              viaTripay: row.tripayTransaksi.length > 0,
            }),
      nominal: row.total,
      periode: row.jatuh_tempo,
      pemroses: formatPembayaranProcessorLabel(
        processor?.inputter,
        processor?.viaTripay
      ),
      diprosesPada: formatPembayaranProcessedAt(
        processor?.processedAt,
        "lengkap"
      ),
      processedAt: processor?.processedAt ?? null,
      processedDay: processedDayInPeriod(processor?.processedAt, year, month),
    };
  });
}

async function listKantorTransfers(
  mitraId: number | undefined,
  filterPrefix: string,
  year: number,
  month?: number,
  metode: "Cash" | "Transfer" = "Transfer"
): Promise<LabeledPembukuanTransfer[]> {
  const rows = await prisma.pembayaranMitra.findMany({
    where: {
      status: "Terbayar",
      metode,
      tanggal: { startsWith: filterPrefix },
      ...(mitraId ? { userId: mitraId } : {}),
    },
    select: {
      id: true,
      paid: true,
      tanggal: true,
      userId: true,
      user: { select: { nama: true } },
      bank: { select: { bank: true, norek: true } },
      updated: true,
    },
  });

  return rows.map((row) => ({
    id: row.id,
    pembayarKey: `m:${row.userId}`,
    nama: row.user.nama,
    pppoe: "—",
    bank:
      metode === "Cash"
        ? "Cash"
        : transferBankLabel({ bankName: row.bank?.bank, norek: row.bank?.norek }),
    nominal: row.paid,
    periode: row.tanggal,
    pemroses: "—",
    diprosesPada: formatPembayaranProcessedAt(row.updated, "lengkap"),
    processedAt: row.updated.toISOString(),
    processedDay: processedDayInPeriod(row.updated, year, month),
  }));
}
