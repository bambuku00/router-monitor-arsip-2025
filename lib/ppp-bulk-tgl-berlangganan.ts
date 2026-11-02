import { createBackfillPembayaranForPelanggan } from "@/lib/pembayaran-backfill";
import prisma from "@/lib/prisma";
import {
  assertSubscriptionDay,
  formatSubscriptionDate,
  formatSubscriptionMonth,
  parseSubscriptionDate,
  parseYearMonth,
  subscriptionDateInMonth,
  subscriptionDateKey,
} from "@/lib/ppp-subscription-month";
import { getStaffPelangganScopeWhere } from "@/lib/staff-pelanggan-scope";
import type { User } from "lucia";

/**
 * Pindahkan pelanggan yang Tanggal Berlangganannya sama persis dengan `dari`
 * ke bulan `ke`. Hari berbeda di bulan yang sama tidak ikut.
 * `hari` mengisi tanggal yang sama; kosong berarti hari pelanggan tetap.
 * Hanya dipanggil untuk Superadmin.
 */
export async function bulkSetPelangganBulanBerlangganan(
  routerId: number,
  user: Pick<User, "id" | "role" | "ppn">,
  dari: string,
  ke: string,
  hari: number | null
): Promise<{ updated: number; dariLabel: string; keLabel: string; hari: number | null }> {
  if (user.role !== "Superadmin") {
    throw new Error("Hanya superadmin yang boleh mengubah bulan berlangganan sekaligus");
  }
  const source = parseSubscriptionDate(dari);
  const target = parseYearMonth(ke);
  const day = hari == null ? null : assertSubscriptionDay(hari);
  const sourceMonth = `${source.year}-${String(source.month).padStart(2, "0")}`;
  const targetKey = `${target.year}-${String(target.month).padStart(2, "0")}`;
  if (day == null && sourceMonth === targetKey) {
    throw new Error("Bulan tujuan harus berbeda dari bulan yang dipilih");
  }

  const scope = await getStaffPelangganScopeWhere(user);
  const rows = await prisma.pelanggan.findMany({
    where: { routerId, ...scope, tgl: { startsWith: source.key } },
    select: { id: true, tgl: true, paketId: true },
  });
  const matched = rows.filter((row) => subscriptionDateKey(row.tgl) === source.key);
  const labels = {
    dariLabel: formatSubscriptionDate(source.key),
    keLabel: formatSubscriptionMonth(targetKey),
    hari: day,
  };
  if (matched.length === 0) {
    return { updated: 0, ...labels };
  }

  const changed = matched.flatMap((row) => {
    const next = subscriptionDateInMonth(row.tgl, target.year, target.month, day);
    if (row.tgl.trim().slice(0, 10) === next) return [];
    return [{ id: row.id, paketId: row.paketId, tgl: next }];
  });
  if (changed.length === 0) {
    return { updated: 0, ...labels };
  }

  const nextTgl = new Map(changed.map((row) => [row.id, row.tgl]));

  const chunkSize = 50;
  for (let index = 0; index < changed.length; index += chunkSize) {
    const chunk = changed.slice(index, index + chunkSize);
    await prisma.$transaction(
      chunk.map((row) =>
        prisma.pelanggan.update({
          where: { id: row.id },
          data: { tgl: row.tgl },
        })
      )
    );
  }

  const router = await prisma.router.findUnique({
    where: { id: routerId },
    include: {
      users: {
        select: {
          ppn: true,
          billingStartMode: true,
          billingStartDate: true,
          ownedByIsp: true,
        },
      },
    },
  });
  const mitra = router?.users;
  if (mitra) {
    const ppnRate = (mitra.ppn ?? user.ppn ?? 11) / 100;
    for (const row of changed) {
      await createBackfillPembayaranForPelanggan({
        pelangganId: row.id,
        paketId: row.paketId,
        tgl: nextTgl.get(row.id)!,
        inputterId: user.id,
        ppnRate,
        billingStartMode: mitra.billingStartMode ?? null,
        billingStartDate: mitra.billingStartDate ?? null,
        ownedByIsp: mitra.ownedByIsp === true,
      });
    }
  }

  return { updated: changed.length, ...labels };
}
