#!/usr/bin/env npx ts-node
/**
 * Cron auto isolir — dipanggil Linux cron atau manual.
 *
 * Contoh crontab (WIB) — job setiap menit, jam isolir dari pengaturan UI:
 * CRON_TZ=Asia/Jakarta
 * * * * * cd /var/www/router-monitor && flock -n /tmp/router-monitor-auto-isolir.lock npm run auto-isolir >> /var/log/router-monitor-auto-isolir.log 2>&1
 *
 * Pasang/update crontab: bash scripts/setup-cron-auto-isolir.sh
 */
import "dotenv/config";
import {
  CRON_AUTO_ISOLIR_ERROR_MESSAGE,
  executeCronAutoIsolir,
} from "@/lib/cron/auto-isolir-service";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) {
    const { dryRunAutoIsolation } = await import("../lib/auto-isolir/run");
    const userIdArg = process.argv.find((a) => a.startsWith("--user="));
    const userId = userIdArg ? parseInt(userIdArg.split("=")[1], 10) : undefined;
    const result = await dryRunAutoIsolation(userId);
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  }

  try {
    const result = await executeCronAutoIsolir();
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exit(2);
    if (result.failed > 0) process.exit(1);
    process.exit(0);
  } catch (err) {
    console.error(err);
    console.log(JSON.stringify({ error: CRON_AUTO_ISOLIR_ERROR_MESSAGE }, null, 2));
    process.exit(1);
  }
}

main();
