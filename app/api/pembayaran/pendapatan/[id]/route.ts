import { validateRequest } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { staffMenuApiForbidden } from "@/lib/staff-menu-api";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { canAccessUser } from "@/lib/rbac";

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

    if (user.role === "Petugas") {
      return NextResponse.json({ data: [] });
    }

    const params = await segmentData.params;
    if (!params.id) return NextResponse.json("Bad request", { status: 400 });

    const targetUserId = parseInt(params.id);
    
    // SECURITY: Validate user can access this user's revenue data
    if (!canAccessUser(user, targetUserId)) {
      return NextResponse.json("Unauthorized", { status: 403 });
    }

    const tahunParam = request.nextUrl.searchParams.get("tahun");
    const tahun = tahunParam ? parseInt(tahunParam) : new Date().getFullYear();

    const firstDate = new Date(tahun, 0, 1).toLocaleDateString("fr-CA");
    const lastDate = new Date(tahun, 12, 0).toLocaleDateString("fr-CA");
    const result = await prisma.pembayaran.groupBy({
      by: ["status", "jatuh_tempo"],
      where: {
        jatuh_tempo: {
          gte: firstDate,
          lte: lastDate,
        },
        paket: {
          userId: targetUserId,
        },
      },
      _sum: {
        total: true,
      },
    });

    // Initialize variables for the sums
    const monthlyTotals: {
      [key: string]: { total: number; belum: number; terbayar: number };
    } = {};

    // Process the result to get the sums for each status and month
    result.forEach((group) => {
      const month = group.jatuh_tempo.slice(0, 7); // Extract 'YYYY-mm' from 'YYYY-mm-dd'

      if (!monthlyTotals[month]) {
        monthlyTotals[month] = { total: 0, belum: 0, terbayar: 0 };
      }
      monthlyTotals[month].total += group._sum.total || 0;

      if (group.status === "Belum") {
        monthlyTotals[month].belum += group._sum.total || 0;
      } else if (group.status === "Terbayar") {
        monthlyTotals[month].terbayar += group._sum.total || 0;
      }
    });

    // Convert monthlyTotals to an array of objects
    const total = Object.keys(monthlyTotals).map((month) => ({
      month,
      total: monthlyTotals[month].total,
      belum: monthlyTotals[month].belum,
      terbayar: monthlyTotals[month].terbayar,
    }));

    return NextResponse.json({
      data: total,
      message: "Berhasil mendapatkan data pendapatan user",
    });
  } catch (err) {
    const error = err as Error;
    logger.error({ msg: "GET pendapatan error", error: error.message });
    return NextResponse.json(error.message, { status: 400 });
  }
}
