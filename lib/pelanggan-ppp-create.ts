import type { User } from "lucia";
import {
  assertStaffMayMutatePppSecret,
  getPaketForUser,
  getPelangganInScope,
  getRouterForUser,
} from "@/lib/authz";
import {
  allocateNoLayananForCreate,
  dateFromPelangganTgl,
  isLegacyNoLayanan,
} from "@/lib/pelanggan-no-layanan";
import { createBackfillPembayaranForPelanggan } from "@/lib/pembayaran-backfill";
import {
  assertFreeCustomerQuotaAllowed,
  freeCustomerQuotaErrorResponse,
  getOwnerUserIdForRouter,
} from "@/lib/free-customer-quota";
import { resolveIsFreeCustomerForPaket } from "@/lib/pelanggan-billing-category";
import {
  parsePelangganPppCreateBody,
  toPelangganPppWriteData,
} from "@/lib/pelanggan-ppp-create-schema";
import prisma from "@/lib/prisma";

export type CreatePelangganLinkedResult =
  | { ok: true; pelangganId: number; message: string }
  | { ok: false; status: number; body: { message?: string; error?: string } };

/** Simpan pelanggan yang sudah punya (atau baru dihubungkan ke) secret PPP. */
export async function createPelangganLinkedToPpp(
  user: User,
  raw: unknown
): Promise<CreatePelangganLinkedResult> {
  const parsed = parsePelangganPppCreateBody(raw);
  if (!parsed.ok) {
    return { ok: false, status: 400, body: { error: "Data is not valid" } };
  }

  const data = parsed.data;
  const routerId = data.routerId;
  const paketId = data.paketId;
  if (routerId == null || paketId == null) {
    return { ok: false, status: 400, body: { error: "Data is not valid" } };
  }

  const router = await getRouterForUser(routerId, user);
  if (!router) {
    return { ok: false, status: 403, body: { error: "Akses ditolak" } };
  }

  const paket = await getPaketForUser(paketId, user);
  if (!paket) {
    return { ok: false, status: 404, body: { message: "Paket tidak ditemukan" } };
  }

  let secretName: string | null = null;
  if (data.ppp_secretId != null) {
    const pppSecret = await prisma.pppSecret.findUnique({
      where: { id: data.ppp_secretId },
      select: { id: true, routerId: true, name: true },
    });
    if (!pppSecret || pppSecret.routerId !== routerId) {
      return {
        ok: false,
        status: 403,
        body: { message: "PPP tidak ditemukan atau di luar router ini" },
      };
    }
    const scoped = await assertStaffMayMutatePppSecret(user, pppSecret);
    if (!scoped.ok) {
      return { ok: false, status: scoped.status, body: { error: scoped.error } };
    }

    const linkedToPpp = await prisma.pelanggan.findUnique({
      where: { ppp_secretId: data.ppp_secretId },
      select: { id: true },
    });
    if (linkedToPpp) {
      return {
        ok: false,
        status: 409,
        body: { message: "PPP ini sudah terhubung ke data pelanggan" },
      };
    }
    secretName = pppSecret.name.trim();
  }

  const orphan = secretName
    ? await prisma.pelanggan.findFirst({
        where: {
          routerId,
          nama: secretName,
          ppp_secretId: null,
        },
        orderBy: { id: "asc" },
        select: { id: true, noLayanan: true },
      })
    : null;

  if (orphan) {
    const inScope = await getPelangganInScope(orphan.id, user);
    if (!inScope) {
      return { ok: false, status: 403, body: { error: "Akses ditolak" } };
    }
  }

  const ownerUserId = await getOwnerUserIdForRouter(routerId);
  if (ownerUserId == null) {
    return { ok: false, status: 404, body: { error: "Router tidak ditemukan" } };
  }

  try {
    await assertFreeCustomerQuotaAllowed({
      ownerUserId,
      paketHarga: paket.harga,
      excludePelangganId: orphan?.id,
    });
  } catch (err) {
    const quotaErr = freeCustomerQuotaErrorResponse(err);
    if (quotaErr) {
      return {
        ok: false,
        status: quotaErr.status,
        body: { message: quotaErr.message },
      };
    }
    throw err;
  }

  const isFreeCustomer = resolveIsFreeCustomerForPaket(paket.harga);
  const writeData = toPelangganPppWriteData(parsed.data);

  const pelanggan = orphan
    ? await prisma.pelanggan.update({
        where: { id: orphan.id },
        data: {
          ...writeData,
          isFreeCustomer,
          stop: false,
          ...(isLegacyNoLayanan(orphan.noLayanan)
            ? {
                noLayanan: await allocateNoLayananForCreate(
                  dateFromPelangganTgl(writeData.tgl)
                ),
              }
            : {}),
        },
      })
    : await prisma.pelanggan.create({
        data: {
          ...writeData,
          isFreeCustomer,
          noLayanan: await allocateNoLayananForCreate(
            dateFromPelangganTgl(writeData.tgl)
          ),
        },
      });

  const routerWithUser = await prisma.router.findUnique({
    where: { id: pelanggan.routerId! },
    include: { users: true },
  });
  const mitra = routerWithUser?.users;
  const ppnRate = (mitra?.ppn ?? user.ppn ?? 11) / 100;

  if (writeData.tgl && mitra) {
    await createBackfillPembayaranForPelanggan({
      pelangganId: pelanggan.id,
      paketId: paket.id,
      tgl: writeData.tgl,
      inputterId: user.id,
      ppnRate,
      billingStartMode: mitra.billingStartMode ?? null,
      billingStartDate: mitra.billingStartDate ?? null,
      ownedByIsp: mitra.ownedByIsp === true,
    });
  }

  return {
    ok: true,
    pelangganId: pelanggan.id,
    message: orphan
      ? "Berhasil menghubungkan kembali data pelanggan ke PPP"
      : "Berhasil menyimpan data pelanggan",
  };
}
