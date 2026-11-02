#!/usr/bin/env bash
# Pasang cron generate tagihan ke root crontab; npm dijalankan sebagai user aplikasi.
#
# Usage (production, sebagai root):
#   cd /var/www/router-monitor
#   sudo bash scripts/setup-cron-generate.sh
#   sudo bash scripts/setup-cron-generate.sh --app-user mangan
#
# APP_USER (prioritas: --app-user → APP_USER env → default router):
#   VPS Banyuwangi: --app-user router   (default)
#   VPS Malang:     --app-user mangan
#   APP_USER=mangan sudo -E bash scripts/setup-cron-generate.sh
#
# Job Node dijalankan sebagai APP_USER (bukan root). Root hanya flock + redirect log.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/cron-install-common.sh
source "$SCRIPT_DIR/lib/cron-install-common.sh"

cron_install_parse_args "$@"

APP_DIR="${APP_DIR:-$CRON_INSTALL_DEFAULT_APP_DIR}"
LOG_FILE="${LOG_FILE:-/var/log/router-monitor-generate.log}"
ENV_FILE="$APP_DIR/.env"
FLOCK_LOCK="${FLOCK_LOCK:-/tmp/router-monitor-generate-billing.lock}"
CRON_MARKER="# router-monitor generate-billing"
NPM_SCRIPT="generate-billing"

echo "=== Pasang cron generate tagihan (root crontab, APP_USER=$APP_USER) ==="
echo "App dir: $APP_DIR"
echo "Jadwal: 0 * * * * (setiap jam WIB; filter jam/tanggal di job)"
echo

cron_install_run_common_validations "$NPM_SCRIPT"
cron_install_ensure_log_file "$LOG_FILE"

if [[ -f "$ENV_FILE" ]]; then
  if grep -q '^CRON_SECRET=.\+' "$ENV_FILE" 2>/dev/null; then
    echo "[OK] CRON_SECRET ada (endpoint HTTP eksternal)"
  else
    SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p -c 64)
    echo "" >> "$ENV_FILE"
    echo "CRON_SECRET=\"$SECRET\"" >> "$ENV_FILE"
    chown "$APP_USER:$APP_USER" "$ENV_FILE" 2>/dev/null || true
    echo "[OK] CRON_SECRET ditambahkan ke .env (restart PM2 agar HTTP endpoint terbaca)"
  fi
fi

CRON_LINE="$(cron_install_build_line \
  "0 * * * *" "$FLOCK_LOCK" "$NPM_SCRIPT" "$LOG_FILE" "$CRON_MARKER")"

cron_install_upsert_job "$CRON_MARKER" \
  '^0 \* \* \* \* .*npm run generate-billing' \
  "$CRON_LINE" \
  'generate-billing' \
  'router-monitor-generate-billing\.lock' \
  'curl.*generate-billing'

echo
echo "--- Preview root crontab (generate-billing, APP_USER=$APP_USER) ---"
crontab -l 2>/dev/null | grep -E 'generate-billing|CRON_TZ=Asia/Jakarta' || true
echo
echo "=== Selesai ==="
echo "APP_USER: $APP_USER"
echo "Verifikasi: sudo bash scripts/check-cron-generate.sh --app-user $APP_USER"
echo "Log cron:   tail -f $LOG_FILE"
echo
echo "Baris cron:"
echo "$CRON_LINE"
