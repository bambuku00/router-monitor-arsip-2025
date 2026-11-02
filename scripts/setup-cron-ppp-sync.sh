#!/usr/bin/env bash
# Pasang cron background PPPoE sync ke root crontab; npm dijalankan sebagai user aplikasi.
#
# Usage (production, sebagai root):
#   sudo bash scripts/setup-cron-ppp-sync.sh
#   sudo bash scripts/setup-cron-ppp-sync.sh --app-user mangan
#
# APP_USER: --app-user → APP_USER env → default router
# Jadwal default 02:00 WIB: SYNC_HOUR=2 SYNC_MINUTE=0

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/cron-install-common.sh
source "$SCRIPT_DIR/lib/cron-install-common.sh"

cron_install_parse_args "$@"

APP_DIR="${APP_DIR:-$CRON_INSTALL_DEFAULT_APP_DIR}"
LOG_DIR="${LOG_DIR:-$CRON_INSTALL_DEFAULT_LOG_DIR}"
LOG_FILE="$LOG_DIR/ppp-sync.log"
FLOCK_LOCK="${FLOCK_LOCK:-/tmp/router-monitor-ppp-sync.lock}"
CRON_MARKER="# router-monitor ppp-background-sync"
SYNC_HOUR="${SYNC_HOUR:-2}"
SYNC_MINUTE="${SYNC_MINUTE:-0}"
NPM_SCRIPT="sync:ppp-background"

echo "=== Pasang cron PPP background sync (root crontab, APP_USER=$APP_USER) ==="
echo "App dir: $APP_DIR"
echo "Jadwal: $SYNC_HOUR:$(printf '%02d' "$SYNC_MINUTE") WIB (setiap hari)"
echo

cron_install_run_common_validations "$NPM_SCRIPT"
cron_install_ensure_log_file "$LOG_FILE"

CRON_LINE="$(cron_install_build_line \
  "$SYNC_MINUTE $SYNC_HOUR * * *" "$FLOCK_LOCK" "$NPM_SCRIPT" "$LOG_FILE" "$CRON_MARKER")"

cron_install_upsert_job "$CRON_MARKER" \
  "^${SYNC_MINUTE} ${SYNC_HOUR} \\* \\* \\* .*npm run sync:ppp-background" \
  "$CRON_LINE" \
  'sync:ppp-background' \
  'router-monitor-ppp-sync\.lock'

echo
echo "--- Preview root crontab (ppp sync, APP_USER=$APP_USER) ---"
crontab -l 2>/dev/null | grep -E 'sync:ppp-background|CRON_TZ=Asia/Jakarta' || true
echo
echo "=== Selesai ==="
echo "APP_USER: $APP_USER"
echo "Test manual (sebagai $APP_USER, bukan saat install):"
echo "  sudo -u $APP_USER -H bash -lc 'cd $APP_DIR && npm run $NPM_SCRIPT'"
echo "Log cron: tail -f $LOG_FILE"
echo
echo "Baris cron:"
echo "$CRON_LINE"
