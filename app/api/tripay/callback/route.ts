import { tryRestoreIsolirOnPayment } from "@/lib/auto-isolir/run";
import { logger } from "@/lib/logger";
import prisma from "@/lib/prisma";
import {
  decryptTripaySecret,
  tripayCallbackAmountMatches,
  tripayCallbackSignature,
  tripaySignaturesMatch,
} from "@/lib/tripay";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const raw = await request.text();
  let body: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ success: false }, { status: 400 });
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ success: false }, { status: 400 });
  }

  const merchantRef = String(body.merchant_ref ?? "").slice(0, 50);
  if (!merchantRef) {
    return NextResponse.json({ success: false }, { status: 400 });
  }
  const transaksi = await prisma.tripayTransaksi.findUnique({
    where: { merchantRef },
    select: {
      id: true,
      amount: true,
      pembayaranId: true,
      pembayaran: {
        select: {
          id: true,
          status: true,
          total: true,
          pelangganId: true,
          pelanggan: { select: { router: { select: { userId: true } } } },
        },
      },
    },
  });
  if (!transaksi) {
    return NextResponse.json({ success: false }, { status: 404 });
  }

  const mitraUserId = transaksi.pembayaran.pelanggan.router.userId;
  if (!mitraUserId) {
    return NextResponse.json({ success: false }, { status: 400 });
  }
  const gateway = await prisma.tripayGateway.findUnique({
    where: { userId: mitraUserId },
    select: { privateKey: true },
  });
  if (!gateway?.privateKey) {
    return NextResponse.json({ success: false }, { status: 400 });
  }
  const signature = request.headers.get("x-callback-signature") ?? "";
  const expected = tripayCallbackSignature(raw, decryptTripaySecret(gateway.privateKey));
  if (!tripaySignaturesMatch(signature, expected)) {
    return NextResponse.json({ success: false }, { status: 403 });
  }

  const status = String(body.status ?? "UNPAID").slice(0, 16);
  await prisma.tripayTransaksi.update({
    where: { id: transaksi.id },
    data: { status },
  });
  if (status !== "PAID") {
    return NextResponse.json({ success: true });
  }
  if (!tripayCallbackAmountMatches(body, transaksi.amount)) {
    logger.warn({ msg: "Nominal callback Tripay tidak cocok", merchantRef });
    return NextResponse.json({ success: false }, { status: 400 });
  }

  const paid = await prisma.$transaction(async (tx) => {
    const updated = await tx.pembayaran.updateMany({
      where: { id: transaksi.pembayaranId, status: "Belum" },
      data: {
        status: "Terbayar",
        metode: "Transfer",
        inputterId: mitraUserId,
      },
    });
    if (updated.count !== 1) return false;
    await tx.logBayar.create({
      data: {
        pembayaranId: transaksi.pembayaranId,
        inputterId: mitraUserId,
        status: "Terbayar",
        metode: "Transfer",
        total: transaksi.pembayaran.total,
      },
    });
    return true;
  });

  if (paid) {
    try {
      await tryRestoreIsolirOnPayment({
        pelangganId: transaksi.pembayaran.pelangganId,
        pembayaranId: transaksi.pembayaranId,
        executedBy: "Tripay",
      });
    } catch (err) {
      logger.warn({ msg: "Auto restore isolir setelah Tripay gagal", err });
    }
  }

  return NextResponse.json({ success: true });
}
