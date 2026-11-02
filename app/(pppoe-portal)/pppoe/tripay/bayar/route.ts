import { PELANGGAN_PORTAL_COOKIE, readPelangganPortalSession } from "@/lib/pelanggan-portal";
import prisma from "@/lib/prisma";
import { createTripayTransaction, loadActiveTripay } from "@/lib/tripay";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

function originOf(request: NextRequest): string {
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (host) return `${proto}://${host}`;
  return request.nextUrl.origin;
}

function customerPhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("62")) digits = `0${digits.slice(2)}`;
  if (digits.length < 10 || digits.length > 15 || !digits.startsWith("0")) return null;
  return digits;
}

export async function POST(request: NextRequest) {
  const pelangganId = readPelangganPortalSession(
    (await cookies()).get(PELANGGAN_PORTAL_COOKIE)?.value
  );
  if (!pelangganId) {
    return NextResponse.json({ error: "Sesi portal berakhir." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    pembayaranId?: number;
    method?: string;
  } | null;
  const pembayaranId = Number(body?.pembayaranId);
  const method = String(body?.method ?? "")
    .trim()
    .toUpperCase()
    .slice(0, 32);
  if (!Number.isInteger(pembayaranId) || pembayaranId <= 0 || !/^[A-Z0-9_]{2,32}$/.test(method)) {
    return NextResponse.json({ error: "Pilih tagihan dan kanal pembayaran." }, { status: 400 });
  }

  const tagihan = await prisma.pembayaran.findFirst({
    where: { id: pembayaranId, pelangganId, status: "Belum" },
    select: {
      id: true,
      noInvoice: true,
      total: true,
      pelanggan: {
        select: {
          id: true,
          nama: true,
          nomor: true,
          email: true,
          router: { select: { userId: true } },
        },
      },
    },
  });
  if (!tagihan) {
    return NextResponse.json({ error: "Tagihan tidak ditemukan." }, { status: 404 });
  }
  const amount = Math.round(tagihan.total);
  if (amount <= 0) {
    return NextResponse.json({ error: "Nominal tagihan belum bisa dibayar online." }, { status: 400 });
  }
  const phone = customerPhone(tagihan.pelanggan.nomor);
  if (!phone) {
    return NextResponse.json(
      { error: "Nomor HP pelanggan belum bisa dipakai untuk pembayaran." },
      { status: 400 }
    );
  }
  const gateway = await loadActiveTripay(tagihan.pelanggan.router.userId);
  if (!gateway) {
    return NextResponse.json(
      { error: "Pembayaran online belum dihidupkan." },
      { status: 400 }
    );
  }

  const merchantRef = `INV${tagihan.noInvoice}${Date.now()}`.slice(0, 50);
  const origin = originOf(request);
  try {
    const created = await createTripayTransaction({
      ...gateway,
      merchantRef,
      amount,
      method,
      customerName: tagihan.pelanggan.nama || "Pelanggan",
      customerPhone: phone,
      customerEmail: tagihan.pelanggan.email.includes("@")
        ? tagihan.pelanggan.email.slice(0, 80)
        : `p${tagihan.pelanggan.id}@example.com`,
      itemName: `Tagihan INV ${tagihan.noInvoice}`,
      callbackUrl: `${origin}/api/tripay/callback`,
      returnUrl: `${origin}/pppoe`,
    });
    await prisma.tripayTransaksi.create({
      data: {
        pembayaranId: tagihan.id,
        merchantRef,
        reference: created.reference,
        checkoutUrl: created.checkoutUrl,
        amount,
        status: created.status,
      },
    });
    return NextResponse.json({ data: { checkoutUrl: created.checkoutUrl } });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Gagal membuat pembayaran." },
      { status: 502 }
    );
  }
}
