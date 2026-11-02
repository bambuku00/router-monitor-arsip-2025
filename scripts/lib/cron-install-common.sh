#!/usr/bin/env bash
# Shared helpers: pasang job router-monitor ke root crontab, eksekusi npm sebagai user aplikasi.
#
# Mengapa npm dijalankan sebagai user aplikasi (bukan root)?
# - Repo, .env, PM2, dan runtime Node dimiliki/dijalankan user yang sama → permission konsisten.
# - Menghindari file cache/node_modules/log aplikasi tertulis root.
# - DATABASE_URL dan secret di .env dibaca dengan UID yang sama seperti proses web.
#
# User aplikasi ditentukan via --app-user, APP_USER env, atau default router.
# Contoh:
#   sudo bash scripts/setup-cron-generate.sh --app-user mangan
#   APP_USER=mangan sudo -E bash scripts/setup-cron-generate.sh
#
# Root cron tetap dipakai untuk flock + redirect ke /var/log; hanya proses npm via:
#   sudo -u "$APP_USER" -H /path/to/npm run <script>
#
# Urutan: cd APP_DIR (root) → flock (root) → sudo npm (APP_USER). CWD diwariskan ke child sudo.

readonly CRON_INSTALL_DEFAULT_APP_USER="${CRON_INSTALL_DEFAULT_APP_USER:-router}"
readonly CRON_INSTALL_DEFAULT_APP_DIR="${CRON_INSTALL_DEFAULT_APP_DIR:-/var/www/router-monitor}"
readonly CRON_INSTALL_DEFAULT_LOG_DIR="${CRON_INSTALL_DEFAULT_LOG_DIR:-/var/log/router-monitor}"
readonly CRON_INSTALL_TZ_LINE="CRON_TZ=Asia/Jakarta"

# Prioritas APP_USER: --app-user → APP_USER env → default router.
# Tidak mendeteksi dari user yang menjalankan sudo.
cron_install_resolve_app_user_from_args() {
  local from_arg=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --app-user)
        if [[ $# -lt 2 || -z "${2:-}" ]]; then
          echo "GAGAL: --app-user membutuhkan nilai (mis. --app-user mangan)"
          exit 1
        fi
        from_arg="$2"
        shift 2
        ;;
      --app-user=*)
        from_arg="${1#*=}"
        if [[ -z "$from_arg" ]]; then
          echo "GAGAL: --app-user membutuhkan nilai (mis. --app-user=mangan)"
          exit 1
        fi
        shift
        ;;
      *)
        shift
        ;;
    esac
  done

  if [[ -n "$from_arg" ]]; then
    APP_USER="$from_arg"
  else
    APP_USER="${APP_USER:-$CRON_INSTALL_DEFAULT_APP_USER}"
  fi
}

# Installer: tolak argumen selain --app-user.
cron_install_parse_args() {
  local from_arg=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --app-user)
        if [[ $# -lt 2 || -z "${2:-}" ]]; then
          echo "GAGAL: --app-user membutuhkan nilai (mis. --app-user mangan)"
          exit 1
        fi
        from_arg="$2"
        shift 2
        ;;
      --app-user=*)
        from_arg="${1#*=}"
        if [[ -z "$from_arg" ]]; then
          echo "GAGAL: --app-user membutuhkan nilai (mis. --app-user=mangan)"
          exit 1
        fi
        shift
        ;;
      -h|--help)
        echo "Opsi:"
        echo "  --app-user <name>   User aplikasi untuk npm (default: router)"
        echo "  APP_USER=<name>     Alternatif via environment (gunakan sudo -E)"
        exit 0
        ;;
      *)
        echo "GAGAL: argumen tidak dikenal: $1"
        echo "       Contoh: sudo bash scripts/setup-cron-generate.sh --app-user mangan"
        exit 1
        ;;
    esac
  done

  if [[ -n "$from_arg" ]]; then
    APP_USER="$from_arg"
  else
    APP_USER="${APP_USER:-$CRON_INSTALL_DEFAULT_APP_USER}"
  fi
}

cron_install_require_root() {
  if [[ "$(id -u)" -ne 0 ]]; then
    echo "GAGAL: installer cron harus dijalankan sebagai root."
    echo "       Contoh: sudo bash scripts/setup-cron-generate.sh"
    exit 1
  fi
}

cron_install_resolve_bins() {
  FLOCK_BIN="$(command -v flock || true)"
  SUDO_BIN="$(command -v sudo || true)"
  if [[ -z "$FLOCK_BIN" ]]; then
    echo "GAGAL: perintah flock tidak ditemukan (pasang util-linux)."
    exit 1
  fi
  if [[ -z "$SUDO_BIN" ]]; then
    echo "GAGAL: perintah sudo tidak ditemukan."
    exit 1
  fi

  NPM_BIN="$(sudo -u "$APP_USER" -H bash -lc 'command -v npm' 2>/dev/null || true)"
  if [[ -z "$NPM_BIN" ]]; then
    echo "GAGAL: npm tidak ditemukan untuk user $APP_USER."
    echo "       Pastikan Node/npm terpasang dan login shell user $APP_USER punya PATH yang benar."
    exit 1
  fi
  echo "[OK] flock: $FLOCK_BIN"
  echo "[OK] sudo:  $SUDO_BIN"
  echo "[OK] npm ($APP_USER): $NPM_BIN"
}

cron_install_validate_app_user() {
  if [[ -z "${APP_USER:-}" ]]; then
    APP_USER="$CRON_INSTALL_DEFAULT_APP_USER"
  fi
  if ! id "$APP_USER" &>/dev/null; then
    echo "GAGAL: user sistem '$APP_USER' tidak ada."
    exit 1
  fi
  echo "[OK] User aplikasi (APP_USER): $APP_USER"
}

cron_install_validate_app_dir() {
  APP_DIR="${APP_DIR:-$CRON_INSTALL_DEFAULT_APP_DIR}"
  if [[ ! -d "$APP_DIR" ]]; then
    echo "GAGAL: direktori app tidak ada: $APP_DIR"
    exit 1
  fi
  if [[ ! -f "$APP_DIR/package.json" ]]; then
    echo "GAGAL: $APP_DIR/package.json tidak ditemukan"
    exit 1
  fi
  echo "[OK] App dir: $APP_DIR"
}

cron_install_validate_npm_script() {
  local script_name="$1"
  if ! node -e "
    const p = require('${APP_DIR}/package.json');
    if (!p.scripts || !p.scripts['${script_name}']) process.exit(1);
  " 2>/dev/null; then
    echo "GAGAL: script npm '$script_name' tidak ada di package.json"
    exit 1
  fi
  echo "[OK] Script npm: $script_name"
}

cron_install_validate_app_user_access() {
  if ! sudo -u "$APP_USER" test -d "$APP_DIR"; then
    echo "GAGAL: user $APP_USER tidak bisa masuk ke direktori $APP_DIR"
    echo "       Periksa ownership/permission direktori (mis. chown -R ${APP_USER}:${APP_USER} $APP_DIR)."
    exit 1
  fi
  if [[ -f "$APP_DIR/.env" ]]; then
    if ! sudo -u "$APP_USER" test -r "$APP_DIR/.env"; then
      echo "GAGAL: user $APP_USER tidak bisa membaca $APP_DIR/.env"
      echo "       Perbaiki ownership file (mis. chown ${APP_USER}:${APP_USER} .env) — jangan chmod 777."
      exit 1
    fi
    echo "[OK] User $APP_USER dapat membaca .env"
  else
    echo "[WARN] $APP_DIR/.env belum ada — job CLI mungkin gagal saat runtime"
  fi
}

# Alias lama (internal).
cron_install_validate_router_access() {
  cron_install_validate_app_user_access
}

cron_install_safe_validate_npm() {
  local script_name="$1"
  if ! sudo -u "$APP_USER" -H bash -lc "cd '$APP_DIR' && '$NPM_BIN' --version >/dev/null 2>&1"; then
    echo "GAGAL: user $APP_USER tidak dapat menjalankan npm."
    exit 1
  fi
  if ! sudo -u "$APP_USER" -H bash -lc "cd '$APP_DIR' && node -e \"const s=require('./package.json').scripts; if(!s['${script_name}']) process.exit(1)\""; then
    echo "GAGAL: validasi script npm '$script_name' gagal untuk user $APP_USER"
    exit 1
  fi
  echo "[OK] Validasi aman: user $APP_USER siap menjalankan npm run $script_name (tanpa eksekusi job bisnis)"
}

cron_install_ensure_log_dir() {
  local log_dir="${1:-$CRON_INSTALL_DEFAULT_LOG_DIR}"
  mkdir -p "$log_dir"
  chmod 755 "$log_dir" 2>/dev/null || true
  echo "[OK] Log dir: $log_dir"
}

cron_install_ensure_log_file() {
  local log_file="$1"
  local log_dir
  log_dir="$(dirname "$log_file")"
  cron_install_ensure_log_dir "$log_dir"
  touch "$log_file"
  chmod 644 "$log_file" 2>/dev/null || true
  echo "[OK] Log file: $log_file"
}

cron_install_build_line() {
  local schedule="$1"
  local lock_file="$2"
  local npm_script="$3"
  local log_file="$4"
  local marker="$5"
  printf '%s cd %s && %s -n %s %s -u %s -H %s run %s >> %s 2>&1 %s' \
    "$schedule" "$APP_DIR" "$FLOCK_BIN" "$lock_file" \
    "$SUDO_BIN" "$APP_USER" "$NPM_BIN" "$npm_script" "$log_file" "$marker"
}

cron_install_read_crontab() {
  crontab -l 2>/dev/null || true
}

cron_install_strip_lines() {
  local input="$1"
  local marker="$2"
  shift 2
  local pat result="$input"
  for pat in "$@"; do
    result=$(echo "$result" | grep -vE "$pat" || true)
  done
  result=$(echo "$result" | grep -vF "$marker" || true)
  echo "$result"
}

# Args: marker schedule_regex cron_line strip_pattern...
cron_install_upsert_job() {
  local marker="$1"
  local schedule_regex="$2"
  local cron_line="$3"
  shift 3
  local strip_patterns=("$@")

  local existing stripped has_tz already_correct
  existing="$(cron_install_read_crontab)"
  stripped="$(cron_install_strip_lines "$existing" "$marker" "${strip_patterns[@]}")"

  has_tz=false
  if echo "$stripped" | grep -q '^CRON_TZ=Asia/Jakarta'; then
    has_tz=true
  fi

  already_correct=false
  if echo "$existing" | grep -Fq "$marker" \
    && echo "$existing" | grep -F "$marker" | grep -qE "$schedule_regex" \
    && echo "$existing" | grep -F "$marker" | grep -q "sudo -u ${APP_USER} "; then
    already_correct=true
  fi

  if [[ "$already_correct" == "true" ]]; then
    echo "[INFO] Crontab sudah benar ($marker) — tidak diubah."
    echo "$existing" | grep -F "$marker" || true
    return 0
  fi

  {
    echo "$stripped" | grep -v '^$' || true
    if [[ "$has_tz" == "false" ]]; then
      echo "$CRON_INSTALL_TZ_LINE"
    fi
    echo "$cron_line"
  } | crontab -

  echo "[OK] Crontab root dipasang: $marker"
}

cron_install_run_common_validations() {
  local npm_script="$1"
  cron_install_require_root
  cron_install_validate_app_user
  cron_install_validate_app_dir
  cron_install_validate_npm_script "$npm_script"
  cron_install_validate_app_user_access
  cron_install_resolve_bins
  cron_install_safe_validate_npm "$npm_script"
}
