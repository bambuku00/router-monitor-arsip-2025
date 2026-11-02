/**
 * Dry-run inventory: kandidat Paket.nominalPembayaran sebelum migration.
 * READ-ONLY — tidak ada INSERT/UPDATE/DELETE/ALTER.
 *
 * Usage: npx tsx scripts/paket-nominal-inventory-dry-run.ts [--json path]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import {
  brutoTagihanDariDpp,
  paketBreakdownFromHargaDpp,
} from "../lib/pembayaran-tax";
import prisma from "../lib/prisma";

type HistoryBucket = {
  total: number;
  count: number;
  terbayar: number;
  belum: number;
  firstJatuhTempo: string | null;
  lastJatuhTempo: string | null;
};

type PaketCategory =
  | "SAFE_CANDIDATE"
  | "HISTORICAL_FORMULA"
  | "AMBIGUOUS"
  | "NO_HISTORY";

type Confidence = "HIGH" | "MEDIUM" | "REVIEW_REQUIRED";

type PaketInventoryRow = {
  paketId: number;
  namaPaket: string;
  mitraUserId: number;
  mitraNama: string;
  deleted: boolean;
  ppnRate: number;
  hargaDppSaatIni: number;
  kandidatNominalHeuristik: number;
  kandidatNominalFormulaLama: number;
  pelangganAktif: number;
  pelangganTotal: number;
  tagihanTotal: number;
  tagihanTerbayar: number;
  tagihanBelum: number;
  historyDistinct: HistoryBucket[];
  historyModus: number | null;
  historyMin: number | null;
  historyMax: number | null;
  status: PaketCategory;
  recommendedNominal: number | null;
  confidence: Confidence;
  reason: string;
  priceHistoryCaveat: string;
};

function roundTotal(v: number): number {
  return Math.round(Number(v));
}

function buildHistoryBuckets(
  rows: {
    total: number;
    status: string;
    jatuh_tempo: string;
  }[]
): HistoryBucket[] {
  const map = new Map<number, HistoryBucket>();
  for (const row of rows) {
    const total = roundTotal(row.total);
    let bucket = map.get(total);
    if (!bucket) {
      bucket = {
        total,
        count: 0,
        terbayar: 0,
        belum: 0,
        firstJatuhTempo: row.jatuh_tempo,
        lastJatuhTempo: row.jatuh_tempo,
      };
      map.set(total, bucket);
    }
    bucket.count += 1;
    if (row.status === "Terbayar") bucket.terbayar += 1;
    else bucket.belum += 1;
    if (row.jatuh_tempo < (bucket.firstJatuhTempo ?? row.jatuh_tempo)) {
      bucket.firstJatuhTempo = row.jatuh_tempo;
    }
    if (row.jatuh_tempo > (bucket.lastJatuhTempo ?? row.jatuh_tempo)) {
      bucket.lastJatuhTempo = row.jatuh_tempo;
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.total - b.total);
}

function classifyPaket(params: {
  history: HistoryBucket[];
  heuristic: number;
  formulaLegacy: number;
  hargaDpp: number;
}): Pick<
  PaketInventoryRow,
  "status" | "recommendedNominal" | "confidence" | "reason"
> {
  const { history, heuristic, formulaLegacy, hargaDpp } = params;

  if (hargaDpp <= 0) {
    return {
      status: "NO_HISTORY",
      recommendedNominal: 0,
      confidence: "HIGH",
      reason: "Paket gratis (DPP ≤ 0); nominal 0.",
    };
  }

  if (history.length === 0) {
    return {
      status: "NO_HISTORY",
      recommendedNominal: heuristic,
      confidence: "REVIEW_REQUIRED",
      reason:
        "Belum pernah ada Pembayaran; kandidat hanya dari heuristik matematis (bukan bukti input admin).",
    };
  }

  const totalTagihan = history.reduce((s, h) => s + h.count, 0);
  const modus = history[0]!;
  const modusShare = modus.count / totalTagihan;

  const matchesHeuristic = (t: number) => t === heuristic;
  const matchesFormula = (t: number) => t === formulaLegacy;

  const heuristicCount = history
    .filter((h) => matchesHeuristic(h.total))
    .reduce((s, h) => s + h.count, 0);
  const formulaCount = history
    .filter((h) => matchesFormula(h.total))
    .reduce((s, h) => s + h.count, 0);

  const heuristicShare = heuristicCount / totalTagihan;
  const formulaShare = formulaCount / totalTagihan;

  // Dua nominal signifikan (masing-masing ≥20%)
  const significant = history.filter(
    (h) => h.count / totalTagihan >= 0.2
  );
  if (significant.length >= 2) {
    const distinctSignificant = significant.map((h) => h.total).join(", ");
    return {
      status: "AMBIGUOUS",
      recommendedNominal: null,
      confidence: "REVIEW_REQUIRED",
      reason: `Beberapa nominal historis signifikan (≥20%): ${distinctSignificant}. Tidak aman auto-backfill.`,
    };
  }

  if (heuristic === formulaLegacy) {
    if (modusShare >= 0.8 && matchesHeuristic(modus.total)) {
      return {
        status: "SAFE_CANDIDATE",
        recommendedNominal: heuristic,
        confidence: "HIGH",
        reason: `Heuristik = formula lama = ${heuristic}; histori modus ${modus.total} (${Math.round(modusShare * 100)}%).`,
      };
    }
  }

  if (heuristicShare >= 0.8 && heuristic !== formulaLegacy) {
    return {
      status: "SAFE_CANDIDATE",
      recommendedNominal: heuristic,
      confidence: "HIGH",
      reason: `Histori dominan mendukung kandidat heuristik ${heuristic} (${Math.round(heuristicShare * 100)}% tagihan).`,
    };
  }

  if (formulaShare >= 0.8 && formulaLegacy !== heuristic) {
    return {
      status: "HISTORICAL_FORMULA",
      recommendedNominal: heuristic,
      confidence: "REVIEW_REQUIRED",
      reason: `Histori dominan ${formulaLegacy} (${Math.round(formulaShare * 100)}%) = rumus lama DPP→bruto; kandidat nominal-first ${heuristic} belum terbukti dari histori.`,
    };
  }

  if (modusShare >= 0.8) {
    if (matchesHeuristic(modus.total)) {
      return {
        status: "SAFE_CANDIDATE",
        recommendedNominal: heuristic,
        confidence: "HIGH",
        reason: `Modus histori ${modus.total} = heuristik ${heuristic} (${Math.round(modusShare * 100)}%).`,
      };
    }
    if (matchesFormula(modus.total)) {
      return {
        status: "HISTORICAL_FORMULA",
        recommendedNominal: heuristic,
        confidence: "REVIEW_REQUIRED",
        reason: `Modus histori ${modus.total} = formula lama; kandidat nominal-first ${heuristic}.`,
      };
    }
    return {
      status: "AMBIGUOUS",
      recommendedNominal: null,
      confidence: "REVIEW_REQUIRED",
      reason: `Modus histori ${modus.total} tidak cocok heuristik (${heuristic}) maupun formula lama (${formulaLegacy}).`,
    };
  }

  return {
    status: "AMBIGUOUS",
    recommendedNominal: null,
    confidence: "REVIEW_REQUIRED",
    reason: `Distribusi histori tidak dominan (modus ${modus.total} hanya ${Math.round(modusShare * 100)}%).`,
  };
}

function formatHistorySummary(buckets: HistoryBucket[]): string {
  if (buckets.length === 0) return "-";
  return buckets.map((b) => `${b.total}×${b.count}`).join(", ");
}

async function auditPaketPriceHistory(): Promise<string> {
  const pembayaranCols = await prisma.$queryRaw<{ COLUMN_NAME: string }[]>`
    SELECT COLUMN_NAME FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Pembayaran'
    AND COLUMN_NAME LIKE '%harga%'
  `;
  const paketAudit = await prisma.auditLog.findMany({
    where: {
      OR: [
        { action: { contains: "paket" } },
        { endpoint: { contains: "paket" } },
      ],
    },
    select: { id: true, action: true, endpoint: true, created: true },
    take: 5,
    orderBy: { created: "desc" },
  });

  const lines: string[] = [];
  lines.push(
    pembayaranCols.length > 0
      ? `Pembayaran memiliki kolom harga snapshot: ${pembayaranCols.map((c) => c.COLUMN_NAME).join(", ")}`
      : "Pembayaran TIDAK memiliki snapshot harga/DPP — hanya paketId + total."
  );
  lines.push(
    "Paket.harga saat ini adalah satu-satunya DPP tersimpan; perubahan harga paket tidak tercatat terpisah."
  );
  lines.push(
    paketAudit.length > 0
      ? `AuditLog: ditemukan ${paketAudit.length}+ entri terkait paket (contoh action: ${paketAudit.map((a) => a.action).join(", ")}), tetapi tidak memuat histori harga terstruktur.`
      : "AuditLog: tidak ditemukan trail edit harga paket yang dapat dipakai untuk rekonstruksi DPP lama."
  );
  lines.push(
    "Kesimpulan: Pembayaran.total historis tidak selalu dapat dipetakan pasti ke Paket.harga saat tagihan dibuat."
  );
  return lines.join("\n");
}

async function main() {
  const jsonArg = process.argv.indexOf("--json");
  const jsonPath =
    jsonArg >= 0
      ? resolve(process.argv[jsonArg + 1] ?? "backups/staging/paket-nominal-inventory-dry-run.json")
      : resolve("backups/staging/paket-nominal-inventory-dry-run.json");

  const pakets = await prisma.paket.findMany({
    include: {
      user: { select: { id: true, nama: true, ppn: true } },
      pembayaran: {
        select: {
          total: true,
          status: true,
          jatuh_tempo: true,
          nonaktif: true,
        },
      },
      pelanggan: {
        select: { id: true, stop: true },
      },
    },
    orderBy: [{ userId: "asc" }, { id: "asc" }],
  });

  const rows: PaketInventoryRow[] = pakets.map((p) => {
    const ppnRate = p.user.ppn ?? 11;
    const hargaDpp = Math.round(Number(p.harga));
    const heuristic = paketBreakdownFromHargaDpp(hargaDpp, ppnRate).nominal;
    const formulaLegacy = brutoTagihanDariDpp(hargaDpp, ppnRate);

    const activePembayaran = p.pembayaran.filter((pb) => !pb.nonaktif);
    const historyDistinct = buildHistoryBuckets(activePembayaran);

    const pelangganAktif = p.pelanggan.filter((pl) => !pl.stop).length;
    const pelangganTotal = p.pelanggan.length;

    const tagihanTerbayar = activePembayaran.filter(
      (pb) => pb.status === "Terbayar"
    ).length;
    const tagihanBelum = activePembayaran.filter(
      (pb) => pb.status === "Belum"
    ).length;

    const classification = classifyPaket({
      history: historyDistinct,
      heuristic,
      formulaLegacy,
      hargaDpp,
    });

    const priceHistoryCaveat =
      historyDistinct.length > 1 &&
      !historyDistinct.every(
        (h) =>
          h.total === heuristic ||
          h.total === formulaLegacy ||
          h.total === hargaDpp
      )
        ? "Beberapa nominal historis tidak cocok DPP/formula saat ini — mungkin harga paket pernah berubah."
        : historyDistinct.length > 0 &&
            heuristic !== formulaLegacy &&
            formulaLegacy === historyDistinct[0]!.total
          ? "Histori konsisten formula lama terhadap DPP saat ini; intent admin nominal-first tidak tercatat."
          : "Tidak ada bukti perubahan DPP; histori merujuk paketId + DPP sekarang.";

    return {
      paketId: p.id,
      namaPaket: p.nama,
      mitraUserId: p.userId,
      mitraNama: p.user.nama,
      deleted: p.deleted,
      ppnRate,
      hargaDppSaatIni: hargaDpp,
      kandidatNominalHeuristik: heuristic,
      kandidatNominalFormulaLama: formulaLegacy,
      pelangganAktif,
      pelangganTotal,
      tagihanTotal: activePembayaran.length,
      tagihanTerbayar,
      tagihanBelum,
      historyDistinct,
      historyModus: historyDistinct[0]?.total ?? null,
      historyMin:
        historyDistinct.length > 0
          ? Math.min(...historyDistinct.map((h) => h.total))
          : null,
      historyMax:
        historyDistinct.length > 0
          ? Math.max(...historyDistinct.map((h) => h.total))
          : null,
      ...classification,
      priceHistoryCaveat,
    };
  });

  const summary = {
    totalPaket: rows.length,
    paketDeleted: rows.filter((r) => r.deleted).length,
    paketWithPelanggan: rows.filter((r) => r.pelangganTotal > 0).length,
    paketWithoutPelanggan: rows.filter((r) => r.pelangganTotal === 0).length,
    paketWithActivePelanggan: rows.filter((r) => r.pelangganAktif > 0).length,
    SAFE_CANDIDATE: rows.filter((r) => r.status === "SAFE_CANDIDATE").length,
    HISTORICAL_FORMULA: rows.filter((r) => r.status === "HISTORICAL_FORMULA")
      .length,
    AMBIGUOUS: rows.filter((r) => r.status === "AMBIGUOUS").length,
    NO_HISTORY: rows.filter((r) => r.status === "NO_HISTORY").length,
    confidenceHIGH: rows.filter((r) => r.confidence === "HIGH").length,
    confidenceMEDIUM: rows.filter((r) => r.confidence === "MEDIUM").length,
    confidenceREVIEW: rows.filter((r) => r.confidence === "REVIEW_REQUIRED")
      .length,
    generatedAt: new Date().toISOString(),
    readOnly: true,
  };

  const priceHistoryAudit = await auditPaketPriceHistory();

  const payload = { summary, priceHistoryAudit, rows };
  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(jsonPath, JSON.stringify(payload, null, 2), "utf8");

  console.log("=== PAKET NOMINAL INVENTORY DRY-RUN (READ-ONLY) ===\n");
  console.log("A. RINGKASAN GLOBAL");
  console.log(`Total Paket              : ${summary.totalPaket}`);
  console.log(`Paket deleted            : ${summary.paketDeleted}`);
  console.log(`Paket dengan pelanggan   : ${summary.paketWithPelanggan}`);
  console.log(`Paket tanpa pelanggan    : ${summary.paketWithoutPelanggan}`);
  console.log(`Paket pelanggan aktif>0  : ${summary.paketWithActivePelanggan}`);
  console.log(`SAFE_CANDIDATE           : ${summary.SAFE_CANDIDATE}`);
  console.log(`HISTORICAL_FORMULA       : ${summary.HISTORICAL_FORMULA}`);
  console.log(`AMBIGUOUS                : ${summary.AMBIGUOUS}`);
  console.log(`NO_HISTORY               : ${summary.NO_HISTORY}`);
  console.log(`Confidence HIGH          : ${summary.confidenceHIGH}`);
  console.log(`Confidence REVIEW        : ${summary.confidenceREVIEW}`);
  console.log(`\nJSON report: ${jsonPath}\n`);

  console.log("B. TABEL INVENTORY (semua paket)");
  console.log(
    "ID | Mitra | Nama | PPN% | DPP | Heuristik | FormulaLama | Aktif | TotalPel | Tagihan | Histori | Status"
  );
  console.log("-".repeat(120));
  for (const r of rows) {
    const flag = r.deleted ? "[DEL]" : "";
    console.log(
      [
        r.paketId,
        r.mitraNama.slice(0, 12),
        `${r.namaPaket.slice(0, 16)}${flag}`,
        r.ppnRate,
        r.hargaDppSaatIni,
        r.kandidatNominalHeuristik,
        r.kandidatNominalFormulaLama,
        r.pelangganAktif,
        r.pelangganTotal,
        r.tagihanTotal,
        formatHistorySummary(r.historyDistinct),
        r.status,
      ].join(" | ")
    );
  }

  const problemStatuses: PaketCategory[] = [
    "AMBIGUOUS",
    "NO_HISTORY",
    "HISTORICAL_FORMULA",
  ];
  console.log("\nC. DETAIL PAKET PERLU PERHATIAN");
  for (const r of rows.filter((x) => problemStatuses.includes(x.status))) {
    console.log("\n---");
    console.log(
      `Paket #${r.paketId} "${r.namaPaket}" (${r.mitraNama}, PPN ${r.ppnRate}%)`
    );
    console.log(`DPP saat ini: ${r.hargaDppSaatIni}`);
    console.log(
      `Heuristik (matematis): ${r.kandidatNominalHeuristik} | Formula lama: ${r.kandidatNominalFormulaLama}`
    );
    console.log(
      `Pelanggan: ${r.pelangganAktif} aktif / ${r.pelangganTotal} total | Tagihan: ${r.tagihanTotal} (${r.tagihanTerbayar} lunas, ${r.tagihanBelum} belum)`
    );
    console.log(`Status: ${r.status} | ${r.reason}`);
    console.log(`Caveat: ${r.priceHistoryCaveat}`);
    if (r.historyDistinct.length > 0) {
      console.log("History Pembayaran.total:");
      for (const h of r.historyDistinct) {
        console.log(
          `  ${h.total} → ${h.count} record (Terbayar ${h.terbayar}, Belum ${h.belum}) | jatuh_tempo ${h.firstJatuhTempo} … ${h.lastJatuhTempo}`
        );
      }
    }
  }

  console.log("\nD. REKOMENDASI BACKFILL (tidak dieksekusi)");
  console.log("paketId | nama | harga | recommendedNominal | confidence | reason");
  for (const r of rows) {
    console.log(
      [
        r.paketId,
        r.namaPaket.slice(0, 20),
        r.hargaDppSaatIni,
        r.recommendedNominal ?? "NULL",
        r.confidence,
        r.reason.slice(0, 80),
      ].join(" | ")
    );
  }

  console.log("\nE. AUDIT PERUBAHAN HARGA PAKET");
  console.log(priceHistoryAudit);

  const safeIds = rows
    .filter((r) => r.status === "SAFE_CANDIDATE" && r.confidence === "HIGH")
    .map((r) => r.paketId);
  const reviewIds = rows
    .filter((r) => r.confidence === "REVIEW_REQUIRED")
    .map((r) => r.paketId);

  console.log("\n=== KESIMPULAN ===");
  if (rows.length === 0) {
    console.log("TIDAK — tidak ada data Paket di database.");
  } else if (
    summary.AMBIGUOUS === 0 &&
    summary.HISTORICAL_FORMULA + summary.NO_HISTORY <= summary.totalPaket
  ) {
    console.log("YA — sebagian data cukup untuk backfill bertahap.");
    console.log(`  Aman (HIGH / SAFE_CANDIDATE): paketId ${safeIds.join(", ") || "(none)"}`);
    console.log(`  Perlu review manual: paketId ${reviewIds.join(", ") || "(none)"}`);
  } else {
    console.log("YA — dengan catatan review manual wajib untuk paket ambigu.");
    console.log(`  Aman (HIGH): paketId ${safeIds.join(", ") || "(none)"}`);
    console.log(`  Review: paketId ${reviewIds.join(", ") || "(none)"}`);
  }
  console.log("\n[Tidak ada mutasi database pada run ini.]");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
