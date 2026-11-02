/**
 * Migrasi password router plaintext → AES-GCM.
 * Usage: npx ts-node --compiler-options "{\"module\":\"CommonJS\"}" scripts/encrypt-router-passwords.ts
 *
 * Wajib set ROUTER_PASSWORD_ENCRYPTION_KEY di .env sebelum menjalankan.
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

async function main() {
  const {
    encryptRouterPassword,
    hasRouterPasswordEncryptionKey,
    isEncryptedRouterPassword,
  } = await import("../lib/router-password-crypto");
  const { default: prisma } = await import("../lib/prisma");

  if (!hasRouterPasswordEncryptionKey()) {
    console.error(
      "Set ROUTER_PASSWORD_ENCRYPTION_KEY dulu (openssl rand -hex 32)"
    );
    process.exit(1);
  }

  const rows = await prisma.router.findMany({
    select: { id: true, nama: true, password: true },
  });

  let updated = 0;
  let skipped = 0;
  for (const row of rows) {
    if (!row.password || isEncryptedRouterPassword(row.password)) {
      skipped++;
      continue;
    }
    const enc = encryptRouterPassword(row.password);
    await prisma.router.update({
      where: { id: row.id },
      data: { password: enc },
    });
    updated++;
    console.log(`Encrypted router #${row.id} (${row.nama})`);
  }

  console.log(
    `Done. updated=${updated} skipped=${skipped} total=${rows.length}`
  );
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
