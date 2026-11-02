"use server";

import { validateRequest } from "@/lib/auth";
import { getBillContextForPeriod } from "@/lib/billing-generate-config";
import {
  createTagihanForPelangganIfMissing,
  generatePaymentsForMitra,
  runManualBillingGenerateAll,
} from "@/lib/jobs/generate-payments";
import { logger } from "@/lib/logger";
import { pelangganHasPembayaranInPeriod } from "@/lib/pembayaran-backfill";
import prisma from "@/lib/prisma";
import { BillingGenerateLogStatus } from "@prisma/client";

export type TriggerGeneratePaymentsResult =
  | { success: true; message: string }
  | { success: false; error: string };

export async function triggerGeneratePaymentsForMitra(
  mitraUserId: number,
  period: string
): Promise<TriggerGeneratePaymentsResult> {
  const { user } = await validateRequest();

  if (!user || user.role !== "Superadmin") {
    return {
      success: false,
      error: "Hanya Superadmin yang dapat generate tagihan",
    };
  }

  if (!Number.isFinite(mitraUserId) || mitraUserId < 1) {
    return { success: false, error: "Mitra tidak valid" };
  }

  if (!/^\d{4}-\d{2}$/.test(period.trim())) {
    return {
      success: false,
      error: "Pilih bulan di statistik terlebih dahulu (mis. Juni 2026)",
    };
  }

  try {
    const ctx = getBillContextForPeriod(period.trim());
    const result = await generatePaymentsForMitra(mitraUserId, { ctx });

    const periodLabel = new Intl.DateTimeFormat("id-ID", {
      month: "long",
      year: "numeric",
    }).format(new Date(`${ctx.period}-01`));

    if (result.status === BillingGenerateLogStatus.skipped) {
      return {
        success: true,
        message: `${result.message ?? "Generate dilewati"} (${periodLabel}). Tagihan ada: ${result.jmlh}.`,
      };
    }

    if (result.status === BillingGenerateLogStatus.failed) {
      return {
        success: false,
        error: result.message ?? "Generate tagihan gagal",
      };
    }

    if (result.jmlh <= 0) {
      return {
        success: true,
        message: `Generate ${periodLabel}: tidak ada tagihan baru. Cek: pelanggan PPP terhubung, paket harga > 0, mode penagihan mitra (Mulai Sekarang / Bulan Depan), dan grace 30 hari untuk Bulan Depan.`,
      };
    }

    return {
      success: true,
      message: `Generate ${periodLabel}: ${result.jmlh} tagihan dibuat untuk mitra ini.`,
    };
  } catch (err) {
    logger.error({ msg: "Generate tagihan mitra error", mitraUserId, error: err });
    return {
      success: false,
      error: "Gagal generate tagihan. Periksa log server dan koneksi database.",
    };
  }
}

export async function buatTagihanPelangganBulan(
  pelangganId: number,
  mitraUserId: number,
  period: string
): Promise<TriggerGeneratePaymentsResult> {
  const { user } = await validateRequest();
  if (!user || user.role !== "Superadmin") {
    return { success: false, error: "Hanya Superadmin yang dapat membuat tagihan" };
  }
  if (!Number.isInteger(pelangganId) || pelangganId < 1) {
    return { success: false, error: "Pelanggan tidak valid" };
  }
  if (!Number.isInteger(mitraUserId) || mitraUserId < 1) {
    return { success: false, error: "Mitra tidak valid" };
  }
  const periodNorm = period.trim();
  if (!/^\d{4}-\d{2}$/.test(periodNorm)) {
    return { success: false, error: "Bulan tagihan tidak valid" };
  }

  const pelanggan = await prisma.pelanggan.findUnique({
    where: { id: pelangganId },
    select: {
      id: true,
      nama: true,
      router: { select: { userId: true } },
    },
  });
  if (!pelanggan || pelanggan.router.userId !== mitraUserId) {
    return { success: false, error: "Pelanggan tidak ditemukan" };
  }
  if (await pelangganHasPembayaranInPeriod(pelangganId, periodNorm)) {
    return { success: false, error: "Tagihan bulan ini sudah ada" };
  }

  try {
    const created = await createTagihanForPelangganIfMissing({
      pelangganId,
      mitraUserId,
      ctx: getBillContextForPeriod(periodNorm),
    });
    if (!created.created) {
      return {
        success: false,
        error:
          "Tagihan tidak dibuat. Pastikan PPP terhubung, tidak isolir, paket punya harga, dan pelanggan sudah waktunya ditagih.",
      };
    }

    await prisma.tagihanDihapus.deleteMany({
      where: { pelangganId, period: periodNorm },
    });

    const periodLabel = new Intl.DateTimeFormat("id-ID", {
      month: "long",
      year: "numeric",
    }).format(new Date(`${periodNorm}-01`));
    return {
      success: true,
      message: `Tagihan ${periodLabel} untuk ${pelanggan.nama} berhasil dibuat.`,
    };
  } catch (err) {
    logger.error({
      msg: "Buat tagihan pelanggan error",
      pelangganId,
      mitraUserId,
      period: periodNorm,
      error: err,
    });
    return { success: false, error: "Gagal membuat tagihan" };
  }
}

export async function triggerGeneratePayments(): Promise<TriggerGeneratePaymentsResult> {
  const { user } = await validateRequest();

  if (!user || user.role !== "Superadmin") {
    return {
      success: false,
      error: "Hanya Superadmin yang dapat generate tagihan",
    };
  }

  try {
    const result = await runManualBillingGenerateAll();
    const created = result.mitraResults.filter((r) => r.status === "success" && r.jmlh > 0).length;
    const skipped = result.mitraResults.filter((r) => r.status === "skipped").length;
    const failed = result.mitraResults.filter((r) => r.status === "failed").length;
    return {
      success: true,
      message: `Generate tagihan selesai: ${result.jmlh} tagihan (${result.bulan}/${result.period}). Mitra: ${created} sukses, ${skipped} dilewati, ${failed} gagal.`,
    };
  } catch (err) {
    logger.error({ msg: "Generate tagihan error", error: err });
    return {
      success: false,
      error: "Gagal generate tagihan. Periksa log server dan koneksi database.",
    };
  }
}
