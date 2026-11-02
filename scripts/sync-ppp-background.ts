#!/usr/bin/env npx ts-node
/**
 * Background PPPoE sync — dipanggil cron Linux sekali sehari pukul 02:00 WIB.
 *
 * Contoh crontab (WIB):
 * CRON_TZ=Asia/Jakarta
 * 0 2 * * * cd /var/www/router-monitor && flock -n /tmp/router-monitor-ppp-sync.lock npm run sync:ppp-background >> /var/log/router-monitor/ppp-sync.log 2>&1
 *
 * Pasang/update crontab: bash scripts/setup-cron-ppp-sync.sh
 */
import "dotenv/config";
import { runBackgroundPppSyncJob } from "../lib/jobs/ppp-background-sync";

async function main() {
  const result = await runBackgroundPppSyncJob();
  console.log(JSON.stringify(result, null, 2));
  if (result.skippedGlobalLock) process.exit(2);
  if (result.failed > 0) process.exit(1);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
