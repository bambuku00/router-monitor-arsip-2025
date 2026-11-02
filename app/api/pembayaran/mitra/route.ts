import { validateRequest } from "@/lib/auth";
import { staffMenuApiForbidden } from "@/lib/staff-menu-api";
import { PembayaranMitra, PembayaranMitraSchema } from "@/lib/pembayaran-types";
import {
  bulanToDateRange,
  computePembayaranMitraRekapan,
  pembayaranMitraUserWhere,
} from "@/lib/pembayaran-mitra-rekapan";
import prisma from "@/lib/prisma";
import { validatePagination } from "@/lib/utils";
import { verify } from "argon2";
import { errorApiResponse } from "@/lib/server-actions/api";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getBankForUser } from "@/lib/authz";
import { getSuperadminPpnSettings } from "@/lib/ppn-policy";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  try {
    const { user, session } = await validateRequest();
    if (!session || !user) return new Response(null, { status: 401 });

    const deniedGet = staffMenuApiForbidden(user, request.nextUrl.pathname);
    if (deniedGet) return deniedGet;

    if (user.role !== "Superadmin")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { page, limit, skip } = validatePagination(
      request.nextUrl.searchParams.get("page"),
      request.nextUrl.searchParams.get("limit")
    );

    const bulan =
      request.nextUrl.searchParams.get("bulan") ||
      `${new Date().getFullYear()}-${(new Date().getMonth() + 1)
        .toString()
        .padStart(2, "0")}`;
    const { year, month, firstDate, lastDate } = bulanToDateRange(bulan);

    /* PERTAHUN */
    // const months = Array.from(
    //   {
    //     length:
    //       (lastDate.getFullYear() - firstDate.getFullYear()) * 12 +
    //       (lastDate.getMonth() - firstDate.getMonth()) +
    //       1,
    //   },
    //   (_, i) => {
    //     const date = new Date(firstDate);
    //     date.setMonth(date.getMonth() + i);
    //     return {
    //       startOfMonth: new Date(date.getFullYear(), date.getMonth(), 1),
    //       endOfMonth: new Date(date.getFullYear(), date.getMonth() + 1, 0),
    //     };
    //   }
    // );

    const qRaw = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    const searchClause: Prisma.UserWhereInput | undefined =
      qRaw.length > 0
        ? {
            OR: [
              { nama: { contains: qRaw } },
              { user: { contains: qRaw } },
            ],
          }
        : undefined;

    const whereClause: Prisma.UserWhereInput = {
      AND: [pembayaranMitraUserWhere, ...(searchClause ? [searchClause] : [])],
    };

    const total = await prisma.user.count({ where: whereClause });

    const users = await prisma.user.findMany({
      select: {
        id: true,
        nama: true,
        user: true,
        ppn: true,
        omset: true,
        role: true,
        revenueBasis: true,
        revenueShareEnabled: true,
        ownedByIsp: true,
      },
      where: whereClause,
      take: limit,
      skip: skip,
    });

    const ispPpn = await getSuperadminPpnSettings();

    const rekapan = await Promise.all(
      users.map(async (userRow) => {
        const pembayaranMitraRecord = await prisma.pembayaranMitra.findFirst({
          where: {
            tanggal: { gte: firstDate, lte: lastDate },
            userId: userRow.id,
          },
        });
        const pembayaran = await computePembayaranMitraRekapan(
          userRow,
          firstDate,
          lastDate,
          year,
          month
        );
        return {
          ...userRow,
          pembayaran: {
            ...pembayaran,
            bulan,
            metode: pembayaranMitraRecord?.metode,
            bankId: pembayaranMitraRecord?.bankId,
          },
        };
      })
    );

    return NextResponse.json({
      data: rekapan,
      ppnEnabled: ispPpn.ppnEnabled,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      message: "Berhasil mendapatkan data rekap user",
    });
  } catch (err) {
    return errorApiResponse(err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, session } = await validateRequest();
    if (!session || !user) return new Response(null, { status: 401 });

    const deniedPost = staffMenuApiForbidden(user, request.nextUrl.pathname);
    if (deniedPost) return deniedPost;

    if (user.role !== "Superadmin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = (await request.json()) as PembayaranMitra | null;
    const parseSchema = PembayaranMitraSchema.safeParse(data);
    const password = (
      await prisma.user.findFirst({ where: { user: user.user } })
    )?.password;

    if (!data || !parseSchema.success || !password)
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });

    const verifyPassword = await verify(password, data.password);
    if (!verifyPassword)
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });

    // SECURITY (IDOR): bankId harus milik tenant user, cegah referensi bank mitra lain.
    if (data.metode === "Transfer" && data.bankId != null) {
      const ownedBank = await getBankForUser(data.bankId, user);
      if (!ownedBank) {
        return NextResponse.json(
          { error: "Bank tidak ditemukan atau di luar akses Anda" },
          { status: 403 }
        );
      }
    }

    const [year, month] = data.tanggal.slice(0, 7).split("-").map(Number);
    const firstDate = new Date(year, month - 1, 1).toLocaleDateString("fr-CA");
    const lastDate = new Date(year, month, 0).toLocaleDateString("fr-CA");
    const existingPayment = await prisma.pembayaranMitra.findFirst({
      where: {
        userId: data.userId,
        tanggal: {
          gte: firstDate,
          lte: lastDate,
        },
      },
    });

    if (existingPayment) {
      const newPaid = (existingPayment.paid || 0) + (data.paid || 0);
      const status = newPaid >= (existingPayment.total || 0) ? "Terbayar" : "Belum";

      // FINANCIAL: Atomic transaction ensures mitra payment update + audit log are inseparable
      const update = await prisma.$transaction(async (tx) => {
        const updated = await tx.pembayaranMitra.update({
          where: { id: existingPayment.id },
          data: {
            paid: Math.round(newPaid),
            total: Math.round(existingPayment.total),
            status,
            metode: data.metode,
            bankId: data.bankId,
          },
        });
        
        await tx.logBayarMitra.create({
          data: {
            paid: Math.round(data.paid),
            pembayaranId: updated.id,
            status,
            metode: data.metode,
          },
        });
        
        return updated;
      });
      
      return NextResponse.json({
        data: update,
        message: "Pembayaran telah berhasil",
      });
    }

    if (data.id) {
      const current = await prisma.pembayaranMitra.findUnique({
        where: { id: data.id },
      });
      if (!current || current.userId !== data.userId) {
        return NextResponse.json(
          { error: "Unauthorized to manage this payment" },
          { status: 403 }
        );
      }
      const newPaid = (current.paid || 0) + (data.paid || 0);
      const total = current.total ?? data.total;
      const status = newPaid >= total ? "Terbayar" : "Belum";

      // FINANCIAL: Atomic transaction ensures mitra payment update + audit log are inseparable
      const update = await prisma.$transaction(async (tx) => {
        const updated = await tx.pembayaranMitra.update({
          where: { id: data.id },
          data: {
            paid: Math.round(newPaid),
            total: Math.round(total),
            status,
            tanggal: data.tanggal,
            metode: data.metode,
            bankId: data.bankId,
          },
        });
        
        await tx.logBayarMitra.create({
          data: {
            paid: Math.round(data.paid),
            pembayaranId: updated.id,
            status,
            metode: data.metode,
          },
        });
        
        return updated;
      });
      
      return NextResponse.json({
        data: update,
        message: "Pembayaran telah berhasil",
      });
    } else {
      // FINANCIAL: Atomic transaction ensures mitra payment creation + audit log are inseparable
      const create = await prisma.$transaction(async (tx) => {
        const created = await tx.pembayaranMitra.create({
          data: {
            userId: data.userId,
            paid: Math.round(data.paid),
            total: Math.round(data.total),
            status: data.paid >= data.total ? "Terbayar" : "Belum",
            tanggal: data.tanggal,
            metode: data.metode,
            bankId: data.bankId,
          },
        });
        
        await tx.logBayarMitra.create({
          data: {
            paid: Math.round(data.paid),
            pembayaranId: created.id,
            status: data.paid >= data.total ? "Terbayar" : "Belum",
            metode: data.metode,
          },
        });
        
        return created;
      });
      
      return NextResponse.json({
        data: create,
        message: "Pembayaran telah berhasil",
      });
    }
  } catch (err) {
    return errorApiResponse(err);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { user, session } = await validateRequest();
    if (!session || !user) return new Response(null, { status: 401 });

    const deniedDel = staffMenuApiForbidden(user, request.nextUrl.pathname);
    if (deniedDel) return deniedDel;

    if (user.role !== "Superadmin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = (await request.json()) as PembayaranMitra | null;
    const parseSchema = PembayaranMitraSchema.safeParse(data);
    const password = (
      await prisma.user.findFirst({ where: { user: user.user } })
    )?.password;

    if (!data || !parseSchema.success || !password)
      return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });

    const verifyPassword = await verify(password, data.password);
    if (!verifyPassword)
      return NextResponse.json({ error: "Password salah" }, { status: 400 });

    const [year, month] = data.tanggal.slice(0, 7).split("-").map(Number);
    const firstDate = new Date(year, month - 1, 1).toLocaleDateString("fr-CA");
    const lastDate = new Date(year, month, 0).toLocaleDateString("fr-CA");
    const existingPayment = await prisma.pembayaranMitra.findFirst({
      where: {
        userId: data.userId,
        tanggal: {
          gte: firstDate,
          lte: lastDate,
        },
      },
    });

    if (existingPayment) {
      const cancelAmount = data.paid || 0;
      let newPaid = 0;
      let delta = 0;

      if (cancelAmount > 0) {
        if (cancelAmount > (existingPayment.paid || 0)) {
          return NextResponse.json(
            { error: "Nominal pembatalan melebihi total yang sudah dibayar" },
            { status: 400 }
          );
        }
        newPaid = (existingPayment.paid || 0) - cancelAmount;
        delta = -cancelAmount;
      } else {
        newPaid = 0;
        delta = -(existingPayment.paid || 0);
      }

      const status =
        newPaid >= (existingPayment.total || 0) ? "Terbayar" : "Belum";

      const update = await prisma.pembayaranMitra.update({
        where: { id: existingPayment.id },
        data: {
          paid: Math.round(newPaid),
          status,
        },
      });
      await prisma.logBayarMitra.create({
        data: {
          paid: Math.round(delta),
          pembayaranId: update.id,
          status,
        },
      });
      return NextResponse.json({
        data: update,
        message: "Pembayaran telah dibatalkan",
      });
    }

    return NextResponse.json(
      { error: "Pembayaran tidak ditemukan" },
      { status: 404 }
    );
  } catch (err) {
    return errorApiResponse(err);
  }
}
