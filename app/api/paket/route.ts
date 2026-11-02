import {
  DUPLICATE_PAKET_NAME_MESSAGE,
  findActivePaketNameConflict,
} from "@/lib/paket-name-validation";
import { PaketWriteBodySchema } from "@/lib/paket-api-schema";
import { derivePaketPersistFromNominal } from "@/lib/paket-persist";
import { validateRequest } from "@/lib/auth";
import { getOwnedResourcesUserId } from "@/lib/rbac";
import { staffMenuApiForbidden } from "@/lib/staff-menu-api";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const { user, session } = await validateRequest();
    if (!session || !user) return new Response(null, { status: 401 });
    const deniedGet = staffMenuApiForbidden(user, request.nextUrl.pathname);
    if (deniedGet) return deniedGet;
    let json = [];
    if (user.role === "Superadmin") {
      json = await prisma.paket.findMany({
        include: { user: { select: { ppn: true } } },
      });
    } else {
      json = await prisma.paket.findMany({
        where: { userId: getOwnedResourcesUserId(user) },
        include: { user: { select: { ppn: true } } },
      });
    }
    return NextResponse.json({
      data: json,
    });
  } catch (err) {
    const error = err as Error;
    logger.error({ msg: "GET paket error", error: error.message });
    return NextResponse.json(error.message, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, session } = await validateRequest();
    if (!session || !user) return new Response(null, { status: 401 });
    const deniedPost = staffMenuApiForbidden(user, request.nextUrl.pathname);
    if (deniedPost) return deniedPost;

    const raw = await request.json();
    const parsed = PaketWriteBodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json("Data is not valid", { status: 400 });
    }
    const body = parsed.data;

    let ownerId: number;
    if (user.role !== "Superadmin") {
      ownerId = getOwnedResourcesUserId(user);
    } else if (body.userId) {
      const targetUser = await prisma.user.findUnique({
        where: { id: body.userId },
      });
      if (!targetUser) {
        return NextResponse.json("Target user not found", { status: 400 });
      }
      ownerId = body.userId;
    } else {
      ownerId = user.id;
    }

    if (
      await findActivePaketNameConflict({ userId: ownerId, nama: body.nama })
    ) {
      return NextResponse.json(
        { error: DUPLICATE_PAKET_NAME_MESSAGE },
        { status: 400 }
      );
    }

    const owner = await prisma.user.findUnique({
      where: { id: ownerId },
      select: { ppn: true },
    });
    const ppnPercent = owner?.ppn ?? 11;
    const { harga, nominalPembayaran } = derivePaketPersistFromNominal(
      body.nominalPembayaran,
      ppnPercent
    );

    const post = await prisma.paket.create({
      data: {
        nama: body.nama,
        kapasitas: body.kapasitas,
        userId: ownerId,
        harga,
        nominalPembayaran,
      },
    });
    return NextResponse.json({
      data: post,
      message: "Paket berhasil disimpan",
    });
  } catch (err) {
    const error = err as Error;
    logger.error({ msg: "POST paket error", error: error.message });
    return NextResponse.json(error.message, { status: 400 });
  }
}
