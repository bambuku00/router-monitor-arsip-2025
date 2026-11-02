import {
  DUPLICATE_PAKET_NAME_MESSAGE,
  findActivePaketNameConflict,
} from "@/lib/paket-name-validation";
import { PaketWriteBodySchema } from "@/lib/paket-api-schema";
import { derivePaketPersistFromNominal } from "@/lib/paket-persist";
import { validateRequest } from "@/lib/auth";
import { getPaketForUser } from "@/lib/authz";
import { staffMenuApiForbidden } from "@/lib/staff-menu-api";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  const { session, user } = await validateRequest();
  if (!session || !user) return new Response(null, { status: 401 });
  const deniedPut = staffMenuApiForbidden(user, request.nextUrl.pathname);
  if (deniedPut) return deniedPut;

  const raw = await request.json();
  const parsed = PaketWriteBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data is not valid" }, { status: 400 });
  }
  const body = parsed.data;

  const params = await segmentData.params;
  const id = parseInt(params.id);
  if (!params.id) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const existingPaket = await getPaketForUser(id, user);
  if (!existingPaket) {
    return NextResponse.json({ error: "Paket not found or access denied" }, { status: 403 });
  }

  const ownerId =
    user.role !== "Superadmin"
      ? existingPaket.userId
      : (body.userId ?? existingPaket.userId);

  if (
    await findActivePaketNameConflict({
      userId: ownerId,
      nama: body.nama,
      excludePaketId: id,
    })
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

  try {
    const put = await prisma.paket.update({
      where: { id },
      data: {
        nama: body.nama,
        kapasitas: body.kapasitas,
        harga,
        nominalPembayaran,
        ...(user.role !== "Superadmin" ? { userId: existingPaket.userId } : { userId: ownerId }),
      },
    });
    return NextResponse.json({
      data: put,
      message: `Paket ${body.nama} berhasil diubah`,
    });
  } catch (err) {
    const error = err as Error;
    logger.error({ msg: "PUT paket/[id] error", error: error.message });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  const { session, user } = await validateRequest();
  if (!session || !user) return new Response(null, { status: 401 });
  const deniedDel = staffMenuApiForbidden(user, request.nextUrl.pathname);
  if (deniedDel) return deniedDel;
  const params = await segmentData.params;
  if (!params.id) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const id = parseInt(params.id);
  const existingPaket = await getPaketForUser(id, user);
  if (!existingPaket) {
    return NextResponse.json({ error: "Paket not found or access denied" }, { status: 403 });
  }
  try {
    const put = await prisma.paket.update({
      where: { id },
      data: { deleted: true },
    });
    return NextResponse.json({
      data: put,
      message: `Paket ${put.nama} berhasil dihapus`,
    });
  } catch (err) {
    const error = err as Error;
    logger.error({ msg: "DELETE paket/[id] error", error: error.message });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
