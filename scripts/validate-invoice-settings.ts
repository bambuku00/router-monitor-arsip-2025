/**
 * Validasi READ-ONLY struktur tabel InvoiceSettings di database.
 * Tidak melakukan perubahan apa pun (hanya SELECT information_schema).
 *
 * Usage:
 *   npm run validate:invoice-settings
 *
 * Exit code 0 = semua valid, 1 = ada masalah struktur, 2 = error koneksi.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadDotEnv() {
  const p = resolve(process.cwd(), ".env");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

loadDotEnv();

const EXPECTED_COLUMNS = [
  "id",
  "userId",
  "logoSize",
  "logoFilename",
  "qrFilename",
  "bgFilename",
  "bgWatermark",
  "bgSizeMm",
  "bgOpacity",
  "companyName",
  "companySlogan",
  "companyAddress1",
  "companyAddress2",
  "companyAddress3",
  "signatureName",
  "signaturePosition",
  "cashPaymentNote",
  "confirmationNumber",
  "paymentNotes",
  "tandaTerima",
  "ucapanLunas",
  "footerText",
  "ppnStatus",
  "ppnValue",
  "ppnCalculationMode",
  "discountStatus",
  "discountType",
  "discountValue",
  "created",
  "updated",
] as const;

const REMOVED_COLUMNS = ["bgPosition"] as const;

const ok = (m: string) => console.log(`  \u2713 ${m}`);
const bad = (m: string) => console.log(`  \u2717 ${m}`);

async function main() {
  const { default: prisma } = await import("../lib/prisma");
  let problems = 0;

  try {
    console.log("Validasi tabel InvoiceSettings (read-only)\n");

    // 1) Tabel ada? (case-insensitive agar cocok Windows/Linux)
    const tables = await prisma.$queryRawUnsafe<{ TABLE_NAME: string }[]>(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = 'invoicesettings'`
    );

    if (tables.length === 0) {
      bad("Tabel InvoiceSettings TIDAK ditemukan.");
      console.log(
        "\nStatus: GAGAL. Tabel belum ada — jalankan migrasi (lihat DEPLOY_INVOICE_SETTINGS.md)."
      );
      await prisma.$disconnect();
      process.exit(1);
    }

    const actualName = tables[0].TABLE_NAME;
    ok(`Tabel ditemukan. Nama tersimpan di DB: "${actualName}"`);

    // lower_case_table_names: 0 = case-sensitive (Linux default), 1/2 = tidak.
    const lctnRows = await prisma.$queryRawUnsafe<{ v: string | number }[]>(
      `SELECT @@lower_case_table_names AS v`
    );
    const lctn = Number(lctnRows[0]?.v ?? 0);
    const caseSensitive = lctn === 0;

    if (actualName === "InvoiceSettings") {
      ok('Nama tabel canonical benar ("InvoiceSettings").');
    } else if (!caseSensitive) {
      // Windows/macOS default: penyimpanan lowercase itu normal & aman.
      console.log(
        `  \u2713 Nama tersimpan "${actualName}" (server lower_case_table_names=${lctn}, ` +
          `case-insensitive) — normal untuk lingkungan ini.`
      );
    } else {
      // Linux case-sensitive: WAJIB persis "InvoiceSettings".
      bad(
        `Server case-sensitive (lower_case_table_names=0) tetapi tabel bernama "${actualName}". ` +
          `WAJIB "InvoiceSettings" agar cocok dengan Prisma.`
      );
      problems++;
    }

    // 2) Kolom sesuai schema
    const cols = await prisma.$queryRawUnsafe<{ COLUMN_NAME: string }[]>(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = 'invoicesettings'`
    );
    const colSet = new Set(cols.map((c) => c.COLUMN_NAME));

    const missing = EXPECTED_COLUMNS.filter((c) => !colSet.has(c));
    if (missing.length === 0) {
      ok(`Semua ${EXPECTED_COLUMNS.length} kolom wajib ada.`);
    } else {
      bad(`Kolom hilang: ${missing.join(", ")}`);
      problems++;
    }

    const leftover = REMOVED_COLUMNS.filter((c) => colSet.has(c));
    if (leftover.length > 0) {
      bad(`Kolom lama yang harusnya sudah dihapus masih ada: ${leftover.join(", ")}`);
      problems++;
    } else {
      ok("Tidak ada kolom usang (bgPosition sudah tidak ada).");
    }

    const extras = [...colSet].filter(
      (c) =>
        !EXPECTED_COLUMNS.includes(c as (typeof EXPECTED_COLUMNS)[number]) &&
        !REMOVED_COLUMNS.includes(c as (typeof REMOVED_COLUMNS)[number])
    );
    if (extras.length > 0) {
      console.log(`  \u26A0 Kolom ekstra (di luar schema): ${extras.join(", ")}`);
    }

    // 3) Unique index userId
    const uniqIdx = await prisma.$queryRawUnsafe<{ c: bigint }[]>(
      `SELECT COUNT(*) AS c FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = 'invoicesettings'
         AND INDEX_NAME = 'InvoiceSettings_userId_key' AND NON_UNIQUE = 0`
    );
    if (Number(uniqIdx[0].c) > 0) {
      ok("Unique index userId (InvoiceSettings_userId_key) ada.");
    } else {
      // Cek apakah ada unique lain pada userId
      const anyUniqueOnUser = await prisma.$queryRawUnsafe<{ c: bigint }[]>(
        `SELECT COUNT(*) AS c FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = 'invoicesettings'
           AND COLUMN_NAME = 'userId' AND NON_UNIQUE = 0`
      );
      if (Number(anyUniqueOnUser[0].c) > 0) {
        console.log(
          "  \u26A0 Ada unique index pada userId, tetapi nama bukan 'InvoiceSettings_userId_key'."
        );
      } else {
        bad("Unique index pada userId TIDAK ada.");
        problems++;
      }
    }

    // 4) Index userId (non-unique)
    const idx = await prisma.$queryRawUnsafe<{ c: bigint }[]>(
      `SELECT COUNT(*) AS c FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = 'invoicesettings'
         AND INDEX_NAME = 'InvoiceSettings_userId_idx'`
    );
    if (Number(idx[0].c) > 0) {
      ok("Index userId (InvoiceSettings_userId_idx) ada.");
    } else {
      console.log(
        "  \u26A0 Index InvoiceSettings_userId_idx tidak ada (opsional; unique index sudah mencukupi untuk lookup)."
      );
    }

    // 5) Foreign key ke User(id)
    const fk = await prisma.$queryRawUnsafe<
      { CONSTRAINT_NAME: string; REFERENCED_TABLE_NAME: string; REFERENCED_COLUMN_NAME: string }[]
    >(
      `SELECT k.CONSTRAINT_NAME, k.REFERENCED_TABLE_NAME, k.REFERENCED_COLUMN_NAME
       FROM information_schema.KEY_COLUMN_USAGE k
       WHERE k.TABLE_SCHEMA = DATABASE() AND LOWER(k.TABLE_NAME) = 'invoicesettings'
         AND k.COLUMN_NAME = 'userId' AND k.REFERENCED_TABLE_NAME IS NOT NULL`
    );
    if (fk.length === 0) {
      bad("Foreign key userId -> User(id) TIDAK ada.");
      problems++;
    } else {
      const ref = fk[0];
      const refOk =
        ref.REFERENCED_TABLE_NAME.toLowerCase() === "user" &&
        ref.REFERENCED_COLUMN_NAME === "id";
      if (refOk) {
        ok(
          `Foreign key ada (${ref.CONSTRAINT_NAME}) -> ${ref.REFERENCED_TABLE_NAME}(${ref.REFERENCED_COLUMN_NAME}).`
        );
        if (ref.CONSTRAINT_NAME !== "InvoiceSettings_userId_fkey") {
          console.log(
            `  \u26A0 Nama FK bukan 'InvoiceSettings_userId_fkey' (sekarang '${ref.CONSTRAINT_NAME}').`
          );
        }
      } else {
        bad(
          `Foreign key userId mengarah ke ${ref.REFERENCED_TABLE_NAME}(${ref.REFERENCED_COLUMN_NAME}), seharusnya User(id).`
        );
        problems++;
      }
    }

    console.log("");
    if (problems === 0) {
      console.log("Status: OK. Struktur InvoiceSettings valid.");
      await prisma.$disconnect();
      process.exit(0);
    } else {
      console.log(
        `Status: GAGAL. Ditemukan ${problems} masalah struktur. Lihat DEPLOY_INVOICE_SETTINGS.md untuk perbaikan.`
      );
      await prisma.$disconnect();
      process.exit(1);
    }
  } catch (err) {
    console.error(
      "Error koneksi/kueri database:",
      err instanceof Error ? err.message : String(err)
    );
    try {
      await prisma.$disconnect();
    } catch {}
    process.exit(2);
  }
}

main();
