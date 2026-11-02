#!/usr/bin/env bash
# Ganti CRON_SECRET di .env (untuk endpoint HTTP /api/cron/*).
# Crontab CLI root (npm via sudo -u router) tidak menyimpan secret di crontab.
#
# Usage:
#   cd /var/www/router-monitor
#   bash scripts/rotate-cron-secret.sh
#
# Opsional: SECRET="nilai-manual" bash scripts/rotate-cron-secret.sh

set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/router-monitor}"
ENV_FILE="$APP_DIR/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "GAGAL: $ENV_FILE tidak ada"
  exit 1
fi

OLD=$(grep '^CRON_SECRET=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' | tr -d "'" || true)
NEW="${SECRET:-$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p -c 64)}"

if [[ -z "$NEW" ]]; then
  echo "GAGAL: tidak bisa buat secret baru"
  exit 1
fi

if grep -q '^CRON_SECRET=' "$ENV_FILE"; then
  sed -i "s|^CRON_SECRET=.*|CRON_SECRET=\"$NEW\"|" "$ENV_FILE"
else
  echo "CRON_SECRET=\"$NEW\"" >> "$ENV_FILE"
fi
echo "[OK] .env diperbarui"

# Hapus crontab curl lama di root jika masih ada (migrasi ke CLI)
read_crontab() {
  if [[ "$(id -u)" -eq 0 ]]; then
    crontab -l 2>/dev/null || true
  else
    sudo crontab -l 2>/dev/null || true
  fi
}
write_crontab() {
  if [[ "$(id -u)" -eq 0 ]]; then
    crontab -
  else
    sudo crontab -
  fi
}

EXISTING="$(read_crontab)"
if echo "$EXISTING" | grep -q 'curl.*generate-billing'; then
  STRIPPED=$(echo "$EXISTING" | grep -v 'curl.*generate-billing' || true)
  echo "$STRIPPED" | write_crontab
  echo "[OK] Entri root crontab curl generate-billing lama dihapus"
  echo "     Pasang cron CLI: sudo bash scripts/setup-cron-generate.sh"
fi

echo
echo "Secret lama: ${OLD:-(tidak ada)}"
echo "Secret baru: $NEW"
echo
echo "Langkah berikut (WAJIB untuk endpoint HTTP):"
echo "  pm2 restart router-monitor --update-env    # sesuaikan nama proses PM2"
echo
echo "Cron CLI (npm run generate-billing) tidak perlu diubah — tidak pakai secret di crontab."
echo
echo "Tes HTTP setelah restart:"
echo "  curl -sS -H \"Authorization: Bearer $NEW\" https://member.winet.id/api/cron/generate-billing"
