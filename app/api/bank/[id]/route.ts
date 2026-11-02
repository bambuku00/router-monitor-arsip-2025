import { validateRequest } from "@/lib/auth";
import { getBankForUser } from "@/lib/authz";
import { staffMenuApiForbidden } from "@/lib/staff-menu-api";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import {
  BankOptionalDefaults,
  BankOptionalDefaultsSchema as BankSchema,
} from "@/prisma/generated/zod";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, user } = await validateRequest();
    if (!session || !user) return new Response(null, { status: 401 });

    const deniedGet = staffMenuApiForbidden(user, request.nextUrl.pathname);
    if (deniedGet) return deniedGet;

    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) return NextResponse.json("Invalid ID", { status: 400 });

    const bank = await getBankForUser(id, user);
    if (!bank) return NextResponse.json("Bank not found or access denied", { status: 403 });

    const bankWithUser = await prisma.bank.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        bank: true,
        norek: true,
        nama: true,
        deleted: true,
        created: true,
        updated: true,
        user: {
          select: {
            id: true,
            nama: true,
            user: true,
            role: true,
          },
        },
      },
    });
    return NextResponse.json({
      data: bankWithUser,
    });
  } catch (err) {
    const error = err as Error;
    logger.error({ msg: "GET bank/[id] error", error: error.message });
    return NextResponse.json(error.message, { status: 400 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, user } = await validateRequest();
    if (!session || !user) return new Response(null, { status: 401 });

    const deniedPut = staffMenuApiForbidden(user, request.nextUrl.pathname);
    if (deniedPut) return deniedPut;

    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) return NextResponse.json("Invalid ID", { status: 400 });

    const bank = await getBankForUser(id, user);
    if (!bank) return NextResponse.json("Bank not found or access denied", { status: 403 });

    const data = (await request.json()) as BankOptionalDefaults | null;
    const parseSchema = BankSchema.safeParse(data);
    if (!data || !parseSchema.success)
      return NextResponse.json("Data is not valid", { status: 400 });

    const updatedBank = await prisma.bank.update({
      where: { id },
      data: {
        bank: data.bank,
        norek: data.norek,
        nama: data.nama,
        hideFromUnpaidInvoice: data.hideFromUnpaidInvoice === true,
        ...(user.role === "Superadmin" ? { userId: data.userId } : {}),
      },
    });

    return NextResponse.json({
      data: updatedBank,
      message: "Bank berhasil diupdate",
    });
  } catch (err) {
    const error = err as Error;
    logger.error({ msg: "PUT bank/[id] error", error: error.message });
    return NextResponse.json(error.message, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, user } = await validateRequest();
    if (!session || !user) return new Response(null, { status: 401 });

    const deniedDel = staffMenuApiForbidden(user, request.nextUrl.pathname);
    if (deniedDel) return deniedDel;

    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) return NextResponse.json("Invalid ID", { status: 400 });

    const bank = await getBankForUser(id, user);
    if (!bank) return NextResponse.json("Bank not found or access denied", { status: 403 });

    await prisma.bank.delete({
      where: { id },
    });

    return NextResponse.json({
      message: "Bank berhasil dihapus",
    });
  } catch (err) {
    const error = err as Error;
    logger.error({ msg: "DELETE bank/[id] error", error: error.message });
    return NextResponse.json(error.message, { status: 400 });
  }
}
