import { validateRequest } from "@/lib/auth";
import { monthJatuhTempoRange } from "@/lib/billing-due-date";
import {
  classifyKosongTagihan,
  loadPelangganBayarKosongSignals,
} from "@/lib/pembayaran-pelanggan-bayar-filter";
import { pelangganUntukPenagihanWhere } from "@/lib/pembayaran-pelanggan-scope";
import { isPppIsolir } from "@/lib/ppp-isolir";
import { getEffectiveRegulatorySettings } from "@/lib/regulatory-summary";
import { resolveStaffPelangganScopeWhere } from "@/lib/staff-pelanggan-scope";
import prisma from "@/lib/prisma";
import { staffMenuApiForbidden } from "@/lib/staff-menu-api";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type PaketRekapEntry = {
  id: number;
  nama: string;
  harga: number;
  pembayaran: {
    id: number;
    total: number;
    status: "Belum" | "Terbayar";
    nonaktif: boolean;
  }[];
  berhenti: number;
  gratis: number;
  belumWaktunya: number;
};

/**
 * Agregasi per paket untuk satu mitra & bulan: tagihan + pelanggan berhenti,
 * gratis, dan belum waktunya tagihan (grace 30 hari).
 */
export async function GET(
  request: NextRequest,
  segmentData: { params: Promise<{ id: string }> }
) {
  try {
    const { user, session } = await validateRequest();
    if (!session || !user) {
      return NextResponse.json({ error: "Tidak terotentikasi" }, { status: 401 });
    }

    const denied = staffMenuApiForbidden(user, request.nextUrl.pathname);
    if (denied) return denied;

    const params = await segmentData.params;
    if (!params.id) {
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }

    const mitraUserId = parseInt(params.id, 10);
    if (Number.isNaN(mitraUserId)) {
      return NextResponse.json({ error: "Bad request" }, { status: 400 });
    }

    if (
      user.role !== "Superadmin" &&
      user.id !== mitraUserId &&
      user.parentId !== mitraUserId
    ) {
      return NextResponse.json({ error: "Akses ditolak" }, { status: 403 });
    }

    const bulan = request.nextUrl.searchParams.get("bulan")?.trim() ?? "";
    if (!/^\d{4}-\d{2}$/.test(bulan)) {
      return NextResponse.json(
        { error: "Parameter bulan wajib format YYYY-MM" },
        { status: 400 }
      );
    }

    const jatuhTempoRange = monthJatuhTempoRange(bulan);

    const staffPelangganWhere = await resolveStaffPelangganScopeWhere(
      user,
      mitraUserId,
      request.nextUrl.searchParams.get("staff")
    );

    const [mitra, pelangganRows, pembayaranRows, paketById, regulatorySettings] =
      await Promise.all([
        prisma.user.findUnique({
          where: { id: mitraUserId },
          select: {
            ppn: true,
            billingStartMode: true,
            billingStartDate: true,
            ownedByIsp: true,
          },
        }),
        prisma.pelanggan.findMany({
          where: {
            router: { userId: mitraUserId },
            ...pelangganUntukPenagihanWhere,
            ...staffPelangganWhere,
          },
          select: {
            id: true,
            stop: true,
            tgl: true,
            paketId: true,
            paket: { select: { id: true, nama: true, harga: true } },
            ppp_secret: { select: { profile: true, isIsolir: true } },
            router: { select: { isolirProfileName: true } },
          },
        }),
        prisma.pembayaran.findMany({
          where: {
            jatuh_tempo: jatuhTempoRange,
            pelanggan: {
              router: { userId: mitraUserId },
              ...staffPelangganWhere,
            },
          },
          select: {
            id: true,
            total: true,
            status: true,
            nonaktif: true,
            pelangganId: true,
            paketId: true,
          },
        }),
        prisma.paket
          .findMany({
            where: { userId: mitraUserId },
            select: { id: true, nama: true, harga: true },
          })
          .then((rows) => new Map(rows.map((p) => [p.id, p]))),
        getEffectiveRegulatorySettings(mitraUserId),
      ]);

    const pembayaranByPelanggan = new Map<
      number,
      (typeof pembayaranRows)[number]
    >();
    for (const row of pembayaranRows) {
      pembayaranByPelanggan.set(row.pelangganId, row);
    }

    const grouped = new Map<number, PaketRekapEntry>();

    function ensurePaketEntry(paket: {
      id: number;
      nama: string;
      harga: number;
    }): PaketRekapEntry {
      let entry = grouped.get(paket.id);
      if (!entry) {
        entry = {
          id: paket.id,
          nama: paket.nama,
          harga: paket.harga,
          pembayaran: [],
          berhenti: 0,
          gratis: 0,
          belumWaktunya: 0,
        };
        grouped.set(paket.id, entry);
      }
      return entry;
    }

    const billingStartMode = mitra?.billingStartMode ?? "NEXT_MONTH";
    const billingStartDate = mitra?.billingStartDate ?? null;
    const ownedByIsp = mitra?.ownedByIsp === true;
    const kosongRows = pelangganRows.filter(
      (pel) =>
        !pembayaranByPelanggan.has(pel.id) &&
        !pel.stop &&
        Math.round(Number(pel.paket.harga)) > 0
    );
    const isolirIds = new Set(
      kosongRows
        .filter(
          (pel) =>
            pel.ppp_secret != null &&
            isPppIsolir(pel.ppp_secret, {
              isolirProfileName: pel.router?.isolirProfileName,
            })
        )
        .map((pel) => pel.id)
    );
    const kosongSignals = await loadPelangganBayarKosongSignals(
      kosongRows.map((pel) => pel.id),
      bulan,
      isolirIds
    );
    const countedPembIds = new Set<number>();

    for (const pel of pelangganRows) {
      const entry = ensurePaketEntry(pel.paket);
      const pemb = pembayaranByPelanggan.get(pel.id);

      if (pemb) {
        entry.pembayaran.push({
          id: pemb.id,
          total: pemb.total,
          status: pemb.status,
          nonaktif: pemb.nonaktif,
        });
        countedPembIds.add(pemb.id);
        continue;
      }

      if (pel.stop) {
        entry.berhenti += 1;
        continue;
      }

      if (Math.round(Number(pel.paket.harga)) <= 0) {
        entry.gratis += 1;
        continue;
      }

      const signal = kosongSignals.get(pel.id);
      if (
        classifyKosongTagihan({
          tgl: pel.tgl,
          period: bulan,
          billingStartMode,
          billingStartDate,
          ownedByIsp,
          hasAnyInvoice: signal?.hasAnyInvoice ?? false,
          hasInvoiceNextMonth: signal?.hasInvoiceNextMonth ?? false,
          isolirStartedAt: signal?.isolirStartedAt ?? null,
          isIsolir: isolirIds.has(pel.id),
        }) === "belum_waktunya"
      ) {
        entry.belumWaktunya += 1;
      }
    }

    for (const pemb of pembayaranRows) {
      if (countedPembIds.has(pemb.id)) continue;
      const paket = paketById.get(pemb.paketId);
      if (!paket) continue;
      const entry = ensurePaketEntry(paket);
      entry.pembayaran.push({
        id: pemb.id,
        total: pemb.total,
        status: pemb.status,
        nonaktif: pemb.nonaktif,
      });
      countedPembIds.add(pemb.id);
    }

    const data = Array.from(grouped.values())
      .filter(
        (row) =>
          row.pembayaran.length > 0 ||
          row.berhenti > 0 ||
          row.gratis > 0 ||
          row.belumWaktunya > 0
      )
      .sort((a, b) => a.harga - b.harga);

    return NextResponse.json({
      data,
      ppn: mitra?.ppn ?? null,
      regulatory: {
        bhpEnabled: regulatorySettings.bhpEnabled,
        bhpPercent: regulatorySettings.bhpPercent,
        usoEnabled: regulatorySettings.usoEnabled,
        usoPercent: regulatorySettings.usoPercent,
      },
      message: "Berhasil mendapatkan rekap per paket",
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 }
    );
  }
}
