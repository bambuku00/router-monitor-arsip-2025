/**
 * Backfill Paket.nominal_pembayaran dari harga DPP + heuristik nominal-first.
 * Default dry-run; mutasi hanya dengan --apply.
 *
 * Usage:
 *   node scripts/backfill-paket-nominal.mjs [--apply] [--json path]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadDotenv } from "dotenv";
import { PrismaClient } from "@prisma/client";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(__dirname, "..", ".env") });

const prisma = new PrismaClient();

/** Override manual (production case Paket #65). */
const MANUAL_NOMINAL_OVERRIDES = new Map([[65, 550_000]]);

/** @see lib/pembayaran-tax.ts paketBreakdownFromHargaDpp */
function paketBreakdownFromHargaDpp(hargaDpp, ppnPercent) {
  const harga = Math.round(Number(hargaDpp));
  if (harga <= 0) return { harga: 0, ppn: 0, nominal: 0 };

  const denom = 100 + ppnPercent;
  let nominal = Math.round((harga * denom) / 100);
  if (Math.round((nominal * 100) / denom) !== harga) {
    if (Math.round(((nominal + 1) * 100) / denom) === harga) nominal += 1;
    else if (Math.round(((nominal - 1) * 100) / denom) === harga) nominal -= 1;
  }
  while (Math.round(((nominal + 1) * 100) / denom) === harga) {
    nominal += 1;
  }
  return { harga, ppn: nominal - harga, nominal };
}

function resolveTargetNominal(paket, ppnPercent) {
  if (MANUAL_NOMINAL_OVERRIDES.has(paket.id)) {
    return {
      nominal: MANUAL_NOMINAL_OVERRIDES.get(paket.id),
      source: "manual_override",
    };
  }
  const hargaDpp = Math.round(Number(paket.harga));
  if (hargaDpp <= 0) {
    return { nominal: 0, source: "gratis" };
  }
  const { nominal } = paketBreakdownFromHargaDpp(hargaDpp, ppnPercent);
  return { nominal, source: "heuristic" };
}

function parseArgs(argv) {
  const apply = argv.includes("--apply");
  const jsonIdx = argv.indexOf("--json");
  const jsonPath =
    jsonIdx >= 0 && argv[jsonIdx + 1]
      ? resolve(argv[jsonIdx + 1])
      : resolve(__dirname, "..", "backups", "staging", "backfill-paket-nominal-dry-run.json");
  return { apply, jsonPath };
}

async function main() {
  const { apply, jsonPath } = parseArgs(process.argv.slice(2));

  const pakets = await prisma.paket.findMany({
    where: { deleted: false },
    select: {
      id: true,
      nama: true,
      harga: true,
      nominalPembayaran: true,
      userId: true,
      user: { select: { ppn: true, nama: true } },
    },
    orderBy: { id: "asc" },
  });

  const plan = [];
  let skippedAlreadySet = 0;
  let toUpdate = 0;

  for (const paket of pakets) {
    const ppnPercent = paket.user?.ppn ?? 11;
    if (
      paket.nominalPembayaran != null &&
      Number.isFinite(paket.nominalPembayaran)
    ) {
      skippedAlreadySet += 1;
      plan.push({
        paketId: paket.id,
        nama: paket.nama,
        mitra: paket.user?.nama ?? String(paket.userId),
        hargaDpp: paket.harga,
        currentNominal: paket.nominalPembayaran,
        targetNominal: paket.nominalPembayaran,
        source: "already_set",
        action: "skip",
      });
      continue;
    }

    const { nominal, source } = resolveTargetNominal(paket, ppnPercent);
    toUpdate += 1;
    plan.push({
      paketId: paket.id,
      nama: paket.nama,
      mitra: paket.user?.nama ?? String(paket.userId),
      ppnPercent,
      hargaDpp: paket.harga,
      currentNominal: paket.nominalPembayaran,
      targetNominal: nominal,
      source,
      action: apply ? "update" : "would_update",
    });
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    mode: apply ? "apply" : "dry_run",
    summary: {
      totalPaket: pakets.length,
      skippedAlreadySet,
      toUpdate,
      manualOverrides: [...MANUAL_NOMINAL_OVERRIDES.entries()].map(
        ([id, nominal]) => ({ paketId: id, nominal })
      ),
    },
    plan,
  };

  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(jsonPath, JSON.stringify(payload, null, 2), "utf8");

  console.log("=== BACKFILL PAKET NOMINAL ===");
  console.log(`Mode           : ${apply ? "APPLY (mutasi DB)" : "DRY-RUN"}`);
  console.log(`Total paket    : ${pakets.length}`);
  console.log(`Sudah terisi   : ${skippedAlreadySet}`);
  console.log(`Akan di-update : ${toUpdate}`);
  console.log(`JSON report    : ${jsonPath}\n`);

  for (const row of plan.filter((r) => r.action !== "skip")) {
    console.log(
      [
        row.action === "update" ? "UPDATED" : "PLAN",
        `#${row.paketId}`,
        row.nama.slice(0, 24),
        `DPP ${row.hargaDpp}`,
        `→ nominal ${row.targetNominal}`,
        `(${row.source})`,
      ].join(" | ")
    );
  }

  if (apply && toUpdate > 0) {
    let updated = 0;
    for (const row of plan) {
      if (row.action !== "update") continue;
      await prisma.paket.update({
        where: { id: row.paketId },
        data: { nominalPembayaran: row.targetNominal },
      });
      updated += 1;
    }
    console.log(`\nSelesai: ${updated} baris Paket.nominal_pembayaran di-update.`);
  } else if (!apply && toUpdate > 0) {
    console.log("\n[Tidak ada mutasi — jalankan ulang dengan --apply untuk menulis.]");
  } else {
    console.log("\n[Tidak ada baris yang perlu di-update.]");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
