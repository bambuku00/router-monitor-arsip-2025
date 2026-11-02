import { validateRequest } from "@/lib/auth";
import { resolveStaffPelangganScopeWhere } from "@/lib/staff-pelanggan-scope";
import { staffMenuApiForbidden } from "@/lib/staff-menu-api";
import {
  parseIsolirPelangganFilter,
  pelangganIsolirFilterClause,
} from "@/lib/pembayaran-isolir-filter";
import {
  parsePenagihPelangganFilter,
  pelangganPenagihFilterClause,
} from "@/lib/pembayaran-penagih-filter";
import { penagihScopeForActor } from "@/lib/penagih-akun";
import { monthJatuhTempoRange } from "@/lib/billing-due-date";
import { clampPetugasBulan } from "@/lib/petugas-bulan";
import { tagihanPayloadForAudience } from "@/lib/pembayaran-petugas-response";
import { computeMitraTagihanStatistik } from "@/lib/pembayaran-tagihan-statistik";
import { getRegulatorySummaryForPembayaran } from "@/lib/regulatory-summary";
import { getPppPelangganCountsForBulan } from "@/lib/pembayaran-ppp-counts";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { errorApiResponse } from "@/lib/server-actions/api";

export async function GET(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  try {
    const { user, session } = await validateRequest();
    if (!session || !user) {
      return NextResponse.json({ error: "Tidak terotentikasi" }, { status: 401 });
    }

    const denied = staffMenuApiForbidden(user, request.nextUrl.pathname);
    if (denied) return denied;

    const params = await segmentData.params;
    if (!params.id) return NextResponse.json("Bad request", { status: 400 });
    const targetId = parseInt(params.id);

    if (
      user.role !== "Superadmin" &&
      user.id !== targetId &&
      user.parentId !== targetId
    ) {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
    }

    const bulanParam =
      request.nextUrl.searchParams.get("bulan") ||
      `${new Date().getFullYear()}-${(new Date().getMonth() + 1)
        .toString()
        .padStart(2, "0")}`;
    const bulan =
      user.role === "Petugas" ? clampPetugasBulan(bulanParam) : bulanParam;

    const [routerRows, penagihRows] = await Promise.all([
      prisma.router.findMany({
        where: { userId: targetId },
        select: { id: true, isolirProfileName: true, deleted: true },
      }),
      prisma.penagih.findMany({
        where: { ownerUserId: targetId },
        select: { id: true },
      }),
    ]);
    const routerParam = parseInt(
      request.nextUrl.searchParams.get("router") || "",
      10
    );
    const routerFilterId = routerRows.some(
      (row) => row.id === routerParam && !row.deleted
    )
      ? routerParam
      : null;
    const isolirFilter = parseIsolirPelangganFilter(
      request.nextUrl.searchParams.get("isolir")
    );
    const isolirWhere = pelangganIsolirFilterClause(isolirFilter, routerRows);
    const actorPenagih = await penagihScopeForActor(user);
    const penagihFilter = parsePenagihPelangganFilter(
      request.nextUrl.searchParams.get("penagih")
    );
    const penagihWhere =
      actorPenagih.where ??
      pelangganPenagihFilterClause(
        penagihFilter,
        new Set(penagihRows.map((row) => row.id))
      );

    const staffPelangganWhere = await resolveStaffPelangganScopeWhere(
      user,
      targetId,
      request.nextUrl.searchParams.get("staff")
    );

    const stat = await computeMitraTagihanStatistik(targetId, bulan, {
      staffPelangganWhere,
      isolirWhere,
      penagihWhere,
      routerId: routerFilterId,
      sembunyikanLunasKantor: request.nextUrl.searchParams.get("rekap") === "petugas",
    });

    if (user.role === "Petugas") {
      return NextResponse.json({
        data: tagihanPayloadForAudience(user.role, stat, null, null),
        message: "Berhasil mendapatkan data tagihan",
      });
    }

    const [pppCounts, regulatory, komisi] = await Promise.all([
      getPppPelangganCountsForBulan(
        targetId,
        bulan,
        staffPelangganWhere,
        routerFilterId
      ),
      getRegulatorySummaryForPembayaran(targetId, stat.grossBagiHasil),
      penagihWhere
        ? prisma.komisiPetugasEntri.aggregate({
            where: {
              ownerUserId: targetId,
              ...(penagihFilter.kind === "id" ? { penagihId: penagihFilter.id } : {}),
              pembayaran: {
                jatuh_tempo: monthJatuhTempoRange(bulan),
                pelanggan: {
                  AND: [
                    {
                      router: {
                        userId: targetId,
                        deleted: false,
                        ...(routerFilterId ? { id: routerFilterId } : {}),
                      },
                    },
                    penagihWhere,
                    ...(staffPelangganWhere ? [staffPelangganWhere] : []),
                    ...(isolirWhere ? [isolirWhere] : []),
                  ],
                },
              },
            },
            _sum: { nominal: true },
          })
        : Promise.resolve(null),
    ]);

    return NextResponse.json({
      data: {
        ...tagihanPayloadForAudience(user.role, stat, regulatory, pppCounts),
        komisi: komisi?._sum.nominal ?? 0,
      },
      message: "Berhasil mendapatkan data tagihan",
    });
  } catch (err) {
    return errorApiResponse(err);
  }
}
