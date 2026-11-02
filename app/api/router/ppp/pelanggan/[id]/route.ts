import { validateRequest } from "@/lib/auth";
import { getPelangganInScope, getPaketForUser } from "@/lib/authz";
import { canStaffManageBerhenti } from "@/lib/staff-permissions";
import { staffMenuApiForbidden } from "@/lib/staff-menu-api";
import { createBackfillPembayaranForPelanggan } from "@/lib/pembayaran-backfill";
import { recordPelangganStatusLog } from "@/lib/pelanggan-status-log";
import { logger } from "@/lib/logger";
import {
  assertFreeCustomerQuotaAllowed,
  freeCustomerQuotaErrorResponse,
  getOwnerUserIdForRouter,
} from "@/lib/free-customer-quota";
import { resolveIsFreeCustomerForPaket } from "@/lib/pelanggan-billing-category";
import { PelangganUpdateSchema } from "@/lib/pelanggan-update-schema";
import prisma from "@/lib/prisma";
import { errorApiResponse } from "@/lib/server-actions/api";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  const { session, user } = await validateRequest();
  if (!session || !user) return new Response(null, { status: 401 });
  const denied = staffMenuApiForbidden(user, request.nextUrl.pathname);
  if (denied) return denied;
  const raw = (await request.json()) as unknown;
  const parseSchema = PelangganUpdateSchema.safeParse(raw);
  if (!parseSchema.success)
    return NextResponse.json(
      { error: "Data is not valid", details: parseSchema.error.flatten() },
      { status: 400 }
    );
  const data = parseSchema.data;
  if (data.stop !== undefined && !canStaffManageBerhenti(user)) {
    return NextResponse.json(
      { error: "Anda tidak diizinkan mengubah status berlangganan pelanggan" },
      { status: 403 }
    );
  }
  const params = await segmentData.params;
  const id = parseInt(params.id);
  if (!params.id) return NextResponse.json("Bad request", { status: 400 });

  try {
    const existing = await prisma.pelanggan.findUnique({
      where: { ppp_secretId: id },
      select: {
        id: true,
        routerId: true,
        stop: true,
        isFreeCustomer: true,
        paketId: true,
      },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Pelanggan tidak ditemukan" },
        { status: 404 }
      );
    }
    const inScope = await getPelangganInScope(existing.id, user);
    if (!inScope) {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
    }

    const isStatusOnly =
      data.stop !== undefined &&
      data.nama === undefined &&
      data.nomor === undefined &&
      data.tgl === undefined &&
      data.paketId === undefined &&
      data.alamat === undefined &&
      data.email === undefined;

    let selectedPaket: { id: number; harga: number } | null = null;

    if (!isStatusOnly) {
      const paket = await getPaketForUser(data.paketId!, user);
      if (!paket) {
        return NextResponse.json(
          { error: "Paket tidak ditemukan atau di luar akses Anda" },
          { status: 403 }
        );
      }
      selectedPaket = paket;

      const ownerUserId = await getOwnerUserIdForRouter(existing.routerId);
      if (ownerUserId == null) {
        return NextResponse.json({ error: "Router tidak ditemukan" }, { status: 404 });
      }

      try {
        await assertFreeCustomerQuotaAllowed({
          ownerUserId,
          paketHarga: paket.harga,
          excludePelangganId: existing.id,
        });
      } catch (err) {
        const quotaErr = freeCustomerQuotaErrorResponse(err);
        if (quotaErr) {
          return NextResponse.json({ error: quotaErr.message }, { status: quotaErr.status });
        }
        throw err;
      }
    } else if (data.stop === false && existing.stop) {
      const paketRow = await prisma.paket.findUnique({
        where: { id: existing.paketId },
        select: { harga: true },
      });
      const willBeFree =
        existing.isFreeCustomer ||
        (paketRow != null && resolveIsFreeCustomerForPaket(paketRow.harga));
      if (willBeFree && paketRow) {
        const ownerUserId = await getOwnerUserIdForRouter(existing.routerId);
        if (ownerUserId == null) {
          return NextResponse.json({ error: "Router tidak ditemukan" }, { status: 404 });
        }
        try {
          await assertFreeCustomerQuotaAllowed({
            ownerUserId,
            paketHarga: paketRow.harga,
          });
        } catch (err) {
          const quotaErr = freeCustomerQuotaErrorResponse(err);
          if (quotaErr) {
            return NextResponse.json({ error: quotaErr.message }, { status: quotaErr.status });
          }
          throw err;
        }
      }
    }

    const isFreeCustomer = isStatusOnly
      ? existing.isFreeCustomer
      : selectedPaket
        ? resolveIsFreeCustomerForPaket(selectedPaket.harga)
        : existing.isFreeCustomer;

    const put = await prisma.pelanggan.update({
      where: { ppp_secretId: id },
      data: isStatusOnly
        ? { stop: data.stop, tgl_stop: data.tgl_stop ?? null }
        : {
            nama: data.nama!,
            nik: data.nik ?? null,
            alamat: data.alamat ?? "",
            nomor: data.nomor!,
            email: data.email ?? "",
            foto: data.foto ?? undefined,
            lat: data.lat ?? undefined,
            lng: data.lng ?? undefined,
            tgl: data.tgl!,
            stop: data.stop,
            tgl_stop: data.tgl_stop ?? undefined,
            tgl_isolir: data.tgl_isolir ?? undefined,
            paketId: data.paketId!,
            isFreeCustomer,
            autoFilledAt: null,
          },
    });

    if (data.tgl) {
      const router = await prisma.router.findUnique({
        where: { id: put.routerId },
        include: { users: true },
      });
      const mitra = router?.users;
      const paketRow = await prisma.paket.findUnique({
        where: { id: put.paketId },
      });

      if (paketRow && mitra) {
        const ppnRate = (mitra.ppn ?? user.ppn ?? 11) / 100;
        await createBackfillPembayaranForPelanggan({
          pelangganId: put.id,
          paketId: paketRow.id,
          tgl: put.tgl,
          inputterId: user.id,
          ppnRate,
          billingStartMode: mitra.billingStartMode ?? null,
          billingStartDate: mitra.billingStartDate ?? null,
          ownedByIsp: mitra.ownedByIsp === true,
        });
      }
    }

    if (data.stop !== undefined && data.stop !== existing.stop) {
      try {
        await recordPelangganStatusLog({
          pelangganId: put.id,
          action: data.stop ? "stop" : "resume",
          actor: user,
        });
      } catch (err) {
        logger.warn({
          msg: "Gagal mencatat pelaku berhenti pelanggan",
          pelangganId: put.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return NextResponse.json({
      data: put,
      message: isStatusOnly
        ? data.stop
          ? "Pelanggan berhenti berlangganan"
          : "Pelanggan mulai berlangganan kembali"
        : `Data Pelanggan ${data.nama} berhasil diubah`,
    });
  } catch (err) {
    const error = err as Error;
    return errorApiResponse(error);
  }
}
