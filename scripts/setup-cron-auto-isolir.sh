#!/usr/bin/env bash
# Pasang cron auto isolir ke root crontab; npm dijalankan sebagai user aplikasi.
#
# Usage (production, sebagai root):
#   sudo bash scripts/setup-cron-auto-isolir.sh
#   sudo bash scripts/setup-cron-auto-isolir.sh --app-user mangan
#
# APP_USER: --app-user → APP_USER env → default router
# Cron memanggil job setiap menit; jam eksekusi per mitra dari pengaturan UI (executeTime).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/cron-install-common.sh
source "$SCRIPT_DIR/lib/cron-install-common.sh"

cron_install_parse_args "$@"

APP_DIR="${APP_DIR:-$CRON_INSTALL_DEFAULT_APP_DIR}"
LOG_FILE="${LOG_FILE:-/var/log/router-monitor-auto-isolir.log}"
FLOCK_LOCK="${FLOCK_LOCK:-/tmp/router-monitor-auto-isolir.lock}"
CRON_MARKER="# router-monitor auto-isolir"
ISOLIR_CRON_SCHEDULE="${ISOLIR_CRON_SCHEDULE:-* * * * *}"
NPM_SCRIPT="auto-isolir"

echo "=== Pasang cron auto isolir (root crontab, APP_USER=$APP_USER) ==="
echo "App dir: $APP_DIR"
echo "Jadwal cron: $ISOLIR_CRON_SCHEDULE (WIB, cek setiap menit; jam isolir dari pengaturan UI)"
echo

cron_install_run_common_validations "$NPM_SCRIPT"
cron_install_ensure_log_file "$LOG_FILE"

CRON_LINE="$(cron_install_build_line \
  "$ISOLIR_CRON_SCHEDULE" "$FLOCK_LOCK" "$NPM_SCRIPT" "$LOG_FILE" "$CRON_MARKER")"

cron_install_upsert_job "$CRON_MARKER" \
  "\\* \\* \\* \\* \\* .*npm run auto-isolir" \
  "$CRON_LINE" \
  '/api/cron/auto-isolir' \
  'npm run auto-isolir' \
  'router-monitor-auto-isolir\.lock'

echo
echo "--- Preview root crontab (auto-isolir, APP_USER=$APP_USER) ---"
crontab -l 2>/dev/null | grep -E 'auto-isolir|CRON_TZ=Asia/Jakarta' || true
echo
echo "=== Selesai ==="
echo "APP_USER: $APP_USER"
echo "Log cron: tail -f $LOG_FILE"
echo
echo "Baris cron:"
echo "$CRON_LINE"
