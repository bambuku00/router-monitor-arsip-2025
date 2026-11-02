#!/usr/bin/env bash
# Cek cron generate tagihan: root crontab + validasi aman user aplikasi.
# Usage: sudo bash scripts/check-cron-generate.sh
#        sudo bash scripts/check-cron-generate.sh --app-user mangan
#        sudo bash scripts/check-cron-generate.sh --app-user mangan https://member.winet.id

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/cron-install-common.sh
source "$SCRIPT_DIR/lib/cron-install-common.sh"

DOMAIN="https://member.winet.id"
APP_USER_ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --app-user)
      if [[ $# -lt 2 ]]; then
        echo "GAGAL: --app-user membutuhkan nilai"
        exit 1
      fi
      APP_USER_ARGS=(--app-user "$2")
      shift 2
      ;;
    --app-user=*)
      APP_USER_ARGS=("$1")
      shift
      ;;
    http://*|https://*)
      DOMAIN="$1"
      shift
      ;;
    *)
      DOMAIN="$1"
      shift
      ;;
  esac
done

cron_install_resolve_app_user_from_args "${APP_USER_ARGS[@]}"

APP_DIR="${APP_DIR:-/var/www/router-monitor}"
LOG_FILE="${LOG_FILE:-/var/log/router-monitor-generate.log}"
CRON_MARKER="# router-monitor generate-billing"

read_root_crontab() {
  if [[ "$(id -u)" -eq 0 ]]; then
    crontab -l 2>/dev/null || true
  elif command -v sudo >/dev/null 2>&1; then
    sudo crontab -l 2>/dev/null || true
  else
    echo ""
  fi
}

echo "=== Router Monitor — cek cron generate tagihan ==="
echo "Domain: $DOMAIN"
echo "App dir: $APP_DIR"
echo "App user: $APP_USER"
echo "Waktu server: $(date)"
echo "Waktu Jakarta: $(TZ=Asia/Jakarta date '+%Y-%m-%d %H:%M:%S %Z')"
echo

if [[ -f "$APP_DIR/.env" ]]; then
  if grep -q '^DATABASE_URL=.\+' "$APP_DIR/.env" 2>/dev/null; then
    echo "[OK] DATABASE_URL ada"
  else
    echo "[GAGAL] DATABASE_URL kosong — CLI cron membutuhkan koneksi DB"
  fi
  if grep -q '^CRON_SECRET=.\+' "$APP_DIR/.env" 2>/dev/null; then
    echo "[OK] CRON_SECRET ada (endpoint HTTP eksternal)"
  else
    echo "[INFO] CRON_SECRET tidak ada — CLI cron tetap jalan; HTTP /api/cron/* akan 503"
  fi
  if id "$APP_USER" &>/dev/null && sudo -u "$APP_USER" test -r "$APP_DIR/.env" 2>/dev/null; then
    echo "[OK] User $APP_USER dapat membaca .env"
  elif id "$APP_USER" &>/dev/null; then
    echo "[GAGAL] User $APP_USER tidak dapat membaca .env"
  fi
else
  echo "[WARN] File .env tidak ditemukan di $APP_DIR"
fi
echo

echo "--- Root crontab (router-monitor generate-billing) ---"
CRON_LINES="$(read_root_crontab)"
if echo "$CRON_LINES" | grep -v '^#' | grep -F "$CRON_MARKER" | grep -q "sudo -u ${APP_USER} .*npm run generate-billing"; then
  echo "$CRON_LINES" | grep -E 'generate-billing|CRON_TZ=Asia/Jakarta' || true
  echo "[OK] Entri root cron CLI (sudo -u $APP_USER) ditemukan"
elif echo "$CRON_LINES" | grep -v '^#' | grep -q 'npm run generate-billing'; then
  echo "$CRON_LINES" | grep -E 'generate-billing|CRON_TZ' || true
  echo "[WARN] Cron generate-billing ada tapi belum sudo -u $APP_USER — jalankan: sudo bash scripts/setup-cron-generate.sh --app-user $APP_USER"
elif echo "$CRON_LINES" | grep -v '^#' | grep -q 'curl.*generate-billing'; then
  echo "[WARN] Masih pakai curl HTTP — migrasi: sudo bash scripts/setup-cron-generate.sh --app-user $APP_USER"
else
  echo "[GAGAL] Tidak ada cron generate-billing di root crontab"
  echo "       Pasang: sudo bash scripts/setup-cron-generate.sh --app-user $APP_USER"
fi
echo

TZ_COUNT=$(echo "$CRON_LINES" | grep -c '^CRON_TZ=Asia/Jakarta' || true)
if [[ "$TZ_COUNT" -eq 1 ]]; then
  echo "[OK] CRON_TZ=Asia/Jakarta tepat satu kali"
elif [[ "$TZ_COUNT" -gt 1 ]]; then
  echo "[WARN] CRON_TZ=Asia/Jakarta duplikat ($TZ_COUNT) — perbaiki root crontab"
fi
echo

echo "--- Log cron ($LOG_FILE) — 15 baris terakhir ---"
if [[ -f "$LOG_FILE" ]]; then
  tail -n 15 "$LOG_FILE" || true
else
  echo "[WARN] Log belum ada"
fi
echo

if id "$APP_USER" &>/dev/null && [[ -f "$APP_DIR/package.json" ]]; then
  echo "--- Validasi aman (tanpa menjalankan job bisnis) ---"
  NPM_BIN="$(sudo -u "$APP_USER" -H bash -lc 'command -v npm' 2>/dev/null || true)"
  if [[ -z "$NPM_BIN" ]]; then
    echo "[GAGAL] npm tidak ditemukan untuk user $APP_USER"
  elif sudo -u "$APP_USER" -H bash -lc "cd '$APP_DIR' && '$NPM_BIN' --version >/dev/null" \
    && sudo -u "$APP_USER" -H bash -lc "cd '$APP_DIR' && node -e \"require('./package.json').scripts['generate-billing']\""; then
    echo "[OK] User $APP_USER siap menjalankan npm run generate-billing"
  else
    echo "[GAGAL] Validasi npm/script gagal untuk user $APP_USER"
  fi
  echo "Test job penuh (manual): sudo -u $APP_USER -H bash -lc 'cd $APP_DIR && npm run generate-billing'"
fi
echo

echo "--- Test endpoint HTTP (tanpa auth) ---"
HTTP=$(curl -sS -o /tmp/rm-cron-test.json -w "%{http_code}" "$DOMAIN/api/cron/generate-billing" 2>/dev/null || echo "000")
BODY=$(cat /tmp/rm-cron-test.json 2>/dev/null || echo "")
echo "HTTP $HTTP"
echo "$BODY" | head -c 500
echo
if [[ "$HTTP" == "401" ]]; then
  echo "[OK] Endpoint HTTP aktif (401)"
elif [[ "$HTTP" == "503" ]]; then
  echo "[INFO] 503 — CRON_SECRET belum di-set"
else
  echo "[WARN] Respons HTTP tidak biasa"
fi

echo
echo "=== Selesai ==="
