#!/usr/bin/env npx ts-node
/**
 * Cron generate tagihan — dipanggil Linux cron setiap jam (eksekusi internal filter jam/hari WIB).
 *
 * Contoh crontab (WIB):
 * CRON_TZ=Asia/Jakarta
 * 0 * * * * cd /var/www/router-monitor && flock -n /tmp/router-monitor-generate-billing.lock npm run generate-billing >> /var/log/router-monitor-generate.log 2>&1
 *
 * Pasang/update crontab: bash scripts/setup-cron-generate.sh
 */
import "dotenv/config";
import {
  CRON_GENERATE_BILLING_ERROR_MESSAGE,
  executeCronGenerateBilling,
} from "@/lib/cron/generate-billing-service";

async function main() {
  try {
    const result = await executeCronGenerateBilling();
    console.log(JSON.stringify(result, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    console.log(
      JSON.stringify({ error: CRON_GENERATE_BILLING_ERROR_MESSAGE }, null, 2)
    );
    process.exit(1);
  }
}

main();
