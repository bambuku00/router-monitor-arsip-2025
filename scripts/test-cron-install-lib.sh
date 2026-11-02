#!/usr/bin/env bash
# Unit-style tests for scripts/lib/cron-install-common.sh (no root/crontab changes).
# Usage: bash scripts/test-cron-install-lib.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/cron-install-common.sh
source "$SCRIPT_DIR/lib/cron-install-common.sh"

APP_DIR=/var/www/router-monitor
FLOCK_BIN=/usr/bin/flock
SUDO_BIN=/usr/bin/sudo
NPM_BIN=/usr/bin/npm

failures=0

assert_contains() {
  local haystack="$1"
  local needle="$2"
  local label="$3"
  if echo "$haystack" | grep -Fq "$needle"; then
    echo "[PASS] $label"
  else
    echo "[FAIL] $label"
    echo "       expected substring: $needle"
    echo "       got: $haystack"
    failures=$((failures + 1))
  fi
}

assert_not_contains() {
  local haystack="$1"
  local needle="$2"
  local label="$3"
  if echo "$haystack" | grep -Fq "$needle"; then
    echo "[FAIL] $label"
    failures=$((failures + 1))
  else
    echo "[PASS] $label"
  fi
}

assert_eq() {
  local got="$1"
  local want="$2"
  local label="$3"
  if [[ "$got" == "$want" ]]; then
    echo "[PASS] $label"
  else
    echo "[FAIL] $label"
    echo "       expected: $want"
    echo "       got:      $got"
    failures=$((failures + 1))
  fi
}

echo "=== test cron-install-common.sh ==="

# --- APP_USER resolution ---
unset APP_USER || true
cron_install_resolve_app_user_from_args
assert_eq "$APP_USER" "router" "default APP_USER is router"

APP_USER=mangan
cron_install_resolve_app_user_from_args
assert_eq "$APP_USER" "mangan" "APP_USER env used when no --app-user"

APP_USER=router
cron_install_resolve_app_user_from_args --app-user mangan
assert_eq "$APP_USER" "mangan" "--app-user overrides APP_USER env"

APP_USER=mangan
cron_install_resolve_app_user_from_args --app-user=router
assert_eq "$APP_USER" "router" "--app-user=router form"

# --- cron line build (configurable user) ---
APP_USER=router
LINE="$(cron_install_build_line \
  "0 * * * *" \
  "/tmp/router-monitor-generate-billing.lock" \
  "generate-billing" \
  "/var/log/router-monitor-generate.log" \
  "# router-monitor generate-billing")"

assert_contains "$LINE" "sudo -u router -H /usr/bin/npm run generate-billing" "sudo npm as router"

APP_USER=mangan
LINE_MANGAN="$(cron_install_build_line \
  "0 * * * *" \
  "/tmp/router-monitor-generate-billing.lock" \
  "generate-billing" \
  "/var/log/router-monitor-generate.log" \
  "# router-monitor generate-billing")"

assert_contains "$LINE_MANGAN" "sudo -u mangan -H /usr/bin/npm run generate-billing" "sudo npm as mangan"
assert_not_contains "$LINE_MANGAN" "sudo -u router " "mangan line does not use router"

assert_contains "$LINE" "0 * * * * cd /var/www/router-monitor &&" "schedule and cd"
assert_contains "$LINE" "/usr/bin/flock -n /tmp/router-monitor-generate-billing.lock" "flock before sudo"
assert_contains "$LINE" ">> /var/log/router-monitor-generate.log 2>&1 # router-monitor generate-billing" "log redirect and marker"

FLOCK_POS=$(echo "$LINE" | awk '{print index($0, "flock")}')
SUDO_POS=$(echo "$LINE" | awk '{print index($0, "sudo")}')
if [[ "$FLOCK_POS" -gt 0 && "$SUDO_POS" -gt "$FLOCK_POS" ]]; then
  echo "[PASS] flock precedes sudo in cron line"
else
  echo "[FAIL] flock should precede sudo in cron line"
  failures=$((failures + 1))
fi

SAMPLE=$'CRON_TZ=Asia/Jakarta\n0 * * * * old curl generate-billing\n10 0 * * * npm run auto-isolir\n'
STRIPPED="$(cron_install_strip_lines "$SAMPLE" "# router-monitor generate-billing" 'generate-billing' 'router-monitor-generate-billing\.lock')"
assert_not_contains "$STRIPPED" "generate-billing" "strip removes generate-billing lines"
assert_contains "$STRIPPED" "npm run auto-isolir" "strip preserves unrelated cron"
assert_contains "$STRIPPED" "CRON_TZ=Asia/Jakarta" "strip preserves CRON_TZ"

# --- parse_args rejects unknown flags ---
set +e
OUTPUT="$(cron_install_parse_args --unknown 2>&1)"
STATUS=$?
set -e
if [[ "$STATUS" -ne 0 ]] && echo "$OUTPUT" | grep -q "argumen tidak dikenal"; then
  echo "[PASS] parse_args rejects unknown arguments"
else
  echo "[FAIL] parse_args should reject unknown arguments"
  failures=$((failures + 1))
fi

unset APP_USER || true
cron_install_parse_args --app-user mangan
assert_eq "$APP_USER" "mangan" "parse_args sets APP_USER from --app-user"

echo
if [[ "$failures" -eq 0 ]]; then
  echo "=== All tests passed ==="
  exit 0
fi
echo "=== $failures test(s) failed ==="
exit 1
