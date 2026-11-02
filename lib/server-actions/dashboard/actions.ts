"use server";

import { validateRequest } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { listPembayaranMitraRekapan } from "@/lib/pembayaran-mitra-rekapan";
import {
  computeMitraTagihanStatistik,
  listMitraPembayaranBulanRows,
} from "@/lib/pembayaran-tagihan-statistik";
import prisma from "@/lib/prisma";
import { getOwnedResourcesUserId } from "@/lib/rbac";
import { countPppTanpaPelangganByRouterId } from "@/lib/routers-ppp-belum-input";

export type MitraDashboardRow = {
  id: number;
  nama: string;
  user: string;
  routerCount: number;
  pelangganAktif: number;
  tagihanPelangganTotal: number;
  tagihanPelangganTerbayar: number;
  tagihanPelangganBelum: number;
  tagihanMitraTotal: number;
  tagihanMitraTerbayar: number;
  tagihanMitraBelum: number;
};

export type PembayaranMitraStats = {
  total: number;
  terbayar: number;
  belum: number;
  count: number;
};

export type PembayaranHarianPoint = {
  day: number;
  label: string;
  terbayar: number;
  belum: number;
  total: number;
  countTerbayar: number;
  countBelum: number;
};

export type DashboardStats = {
  isSuperadmin: boolean;
  bulan: string;
  bulanLabel: string;
  routers: {
    id: number;
    nama: string;
    host: string;
    pelanggan: number;
    pppBelumInput: number;
    mitraNama?: string;
  }[];
  routerCount: number;
  pelangganAktif: number;
  pelangganTotal: number;
  pppBelumInput: number;
  tagihanTotal: number;
  tagihanTerbayar: number;
  tagihanBelum: number;
  pembayaranHarian: PembayaranHarianPoint[];
  mitraCount?: number;
  mitraBreakdown?: MitraDashboardRow[];
  pembayaranMitra?: PembayaranMitraStats;
};

const BULAN_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export async function getDashboardStats(): Promise<
  { data: DashboardStats } | { error: string }
> {
  const { user, session } = await validateRequest();
  if (!session || !user) return { error: "Unauthorized" };

  try {
    const isSuperadmin = user.role === "Superadmin";
    const scopeUserId = isSuperadmin ? null : getOwnedResourcesUserId(user);

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const bulan = `${year}-${String(month).padStart(2, "0")}`;
    const bulanLabel = `${BULAN_ID[month - 1]} ${year}`;

    const routerWhere = {
      deleted: false,
      ...(scopeUserId != null ? { userId: scopeUserId } : {}),
    };

    const pppBelumMap = await countPppTanpaPelangganByRouterId();

    const routersRaw = await prisma.router.findMany({
      where: routerWhere,
      orderBy: { nama: "asc" },
      select: {
        id: true,
        nama: true,
        host: true,
        users: isSuperadmin ? { select: { nama: true } } : false,
        _count: {
          select: {
            pelanggan: { where: { stop: false } },
          },
        },
      },
    });

    const routers = routersRaw.map((r) => ({
      id: r.id,
      nama: r.nama,
      host: r.host,
      pelanggan: r._count.pelanggan,
      pppBelumInput: pppBelumMap.get(r.id) ?? 0,
      ...(isSuperadmin && r.users?.nama
        ? { mitraNama: r.users.nama }
        : {}),
    }));

    const pembayaranBulan =
      scopeUserId != null
        ? await listMitraPembayaranBulanRows(scopeUserId, bulan)
        : [];

    let tagihanTotal = 0;
    let tagihanTerbayar = 0;
    let tagihanBelum = 0;

    if (scopeUserId != null) {
      const stat = await computeMitraTagihanStatistik(scopeUserId, bulan);
      tagihanTotal = stat.total;
      tagihanTerbayar = stat.terbayar;
      tagihanBelum = stat.belum;
    }

    const [routerCount, pelangganAktif, pelangganTotal] = await Promise.all([
      prisma.router.count({ where: routerWhere }),
      prisma.pelanggan.count({
        where: { stop: false, router: routerWhere },
      }),
      prisma.pelanggan.count({
        where: { router: routerWhere },
      }),
    ]);

    const dayMap = new Map<
      number,
      {
        terbayar: number;
        belum: number;
        countTerbayar: number;
        countBelum: number;
      }
    >();

    for (const row of pembayaranBulan) {
      const dayPart = row.jatuh_tempo.split("-")[2];
      const day = dayPart ? parseInt(dayPart, 10) : 1;
      const bucket = dayMap.get(day) ?? {
        terbayar: 0,
        belum: 0,
        countTerbayar: 0,
        countBelum: 0,
      };

      if (row.status === "Terbayar") {
        bucket.terbayar += row.total;
        bucket.countTerbayar += 1;
      } else {
        bucket.belum += row.total;
        bucket.countBelum += 1;
      }
      dayMap.set(day, bucket);
    }

    const daysInMonth = new Date(year, month, 0).getDate();
    const pembayaranHarian: PembayaranHarianPoint[] = Array.from(
      { length: daysInMonth },
      (_, i) => {
        const day = i + 1;
        const bucket = dayMap.get(day) ?? {
          terbayar: 0,
          belum: 0,
          countTerbayar: 0,
          countBelum: 0,
        };
        return {
          day,
          label: String(day),
          terbayar: bucket.terbayar,
          belum: bucket.belum,
          total: bucket.terbayar + bucket.belum,
          countTerbayar: bucket.countTerbayar,
          countBelum: bucket.countBelum,
        };
      }
    );

    const pppBelumInput = routers.reduce((sum, r) => sum + r.pppBelumInput, 0);

    let mitraCount: number | undefined;
    let mitraBreakdown: MitraDashboardRow[] | undefined;
    let pembayaranMitra: PembayaranMitraStats | undefined;

    if (isSuperadmin) {
      const rekapan = await listPembayaranMitraRekapan(bulan);
      pembayaranMitra = rekapan.aggregate;

      const adminIds = rekapan.rows
        .filter((r) => r.user.role === "Admin")
        .map((r) => r.user.id);
      mitraCount = adminIds.length;

      let routerCountMap = new Map<number, number>();
      let pelangganMap = new Map<number, number>();

      if (adminIds.length > 0) {
        const [routerCounts, pelangganByRouter] = await Promise.all([
          prisma.router.groupBy({
            by: ["userId"],
            where: { deleted: false, userId: { in: adminIds } },
            _count: { id: true },
          }),
          prisma.pelanggan.groupBy({
            by: ["routerId"],
            where: {
              stop: false,
              router: { deleted: false, userId: { in: adminIds } },
            },
            _count: { id: true },
          }),
        ]);

        const routerOwnerRows = await prisma.router.findMany({
          where: {
            id: {
              in: pelangganByRouter
                .map((p) => p.routerId)
                .filter((id): id is number => id != null),
            },
          },
          select: { id: true, userId: true },
        });
        const routerOwnerMap = new Map(
          routerOwnerRows.map((r) => [r.id, r.userId])
        );

        routerCountMap = new Map<number, number>();
        for (const row of routerCounts) {
          if (row.userId != null) {
            routerCountMap.set(row.userId, row._count.id);
          }
        }

        pelangganMap = new Map<number, number>();
        for (const row of pelangganByRouter) {
          if (row.routerId == null) continue;
          const ownerId = routerOwnerMap.get(row.routerId);
          if (ownerId == null) continue;
          pelangganMap.set(
            ownerId,
            (pelangganMap.get(ownerId) ?? 0) + row._count.id
          );
        }
      }

      mitraBreakdown = await Promise.all(
        rekapan.rows.map(async ({ user: u, pembayaran: pm }) => {
          const stat =
            u.role === "Admin"
              ? await computeMitraTagihanStatistik(u.id, bulan)
              : null;
          return {
            id: u.id,
            nama: u.nama,
            user: u.user,
            routerCount:
              u.role === "Admin" ? (routerCountMap.get(u.id) ?? 0) : 0,
            pelangganAktif:
              u.role === "Admin" ? (pelangganMap.get(u.id) ?? 0) : 0,
            tagihanPelangganTotal: stat?.total ?? 0,
            tagihanPelangganTerbayar: stat?.terbayar ?? 0,
            tagihanPelangganBelum: stat?.belum ?? 0,
            tagihanMitraTotal: pm.tagihanKantor,
            tagihanMitraTerbayar: pm.bayar,
            tagihanMitraBelum: pm.saldo,
          };
        })
      );

      tagihanTotal = mitraBreakdown.reduce(
        (acc, row) => acc + row.tagihanPelangganTotal,
        0
      );
      tagihanTerbayar = mitraBreakdown.reduce(
        (acc, row) => acc + row.tagihanPelangganTerbayar,
        0
      );
      tagihanBelum = mitraBreakdown.reduce(
        (acc, row) => acc + row.tagihanPelangganBelum,
        0
      );
    }

    return {
      data: {
        isSuperadmin,
        bulan,
        bulanLabel,
        routers,
        routerCount,
        pelangganAktif,
        pelangganTotal,
        pppBelumInput,
        tagihanTotal,
        tagihanTerbayar,
        tagihanBelum,
        pembayaranHarian,
        mitraCount,
        mitraBreakdown,
        pembayaranMitra,
      },
    };
  } catch (err) {
    const error = err as Error;
    logger.error({ msg: "getDashboardStats error", error: error.message });
    return { error: "Terjadi kesalahan pada server" };
  }
}
