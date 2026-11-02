/**
 * Reformat noLayanan legacy (000000000060) → YYYYMM + urutan (202605000054).
 *
 * Usage:
 *   npm run reformat-no-layanan
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
  const { reformatAllLegacyNoLayanan } = await import(
    "../lib/pelanggan-no-layanan"
  );
  const { default: prisma } = await import("../lib/prisma");

  console.log("Reformatting legacy noLayanan → YYYYMM + sequence…");
  const result = await reformatAllLegacyNoLayanan();
  console.log(result);
  console.log("Done.");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
