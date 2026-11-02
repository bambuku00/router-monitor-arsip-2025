# Baseline DB yang sudah ada (tanpa riwayat Prisma Migrate), lalu apply migrasi baru.
# Jalankan dari root project: powershell -File scripts/baseline-and-migrate.ps1

$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

$applied = @(
  "20260208094225_billing_start_per_mitra",
  "20260507105048_add_staff_menu_keys",
  "20260507111141_",
  "20260530120000_add_regulatory_bhp_uso",
  "20260530140000_add_isolir_profile_fields",
  "20260530160000_add_auto_isolir",
  "20260530180000_add_revenue_basis",
  "20260530210000_add_billing_generate_settings"
)

Write-Host "=== Mark migrasi lama sebagai sudah diterapkan (baseline) ===" -ForegroundColor Cyan
foreach ($name in $applied) {
  Write-Host "resolve --applied $name"
  npx prisma migrate resolve --applied $name
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Lewati (mungkin sudah di-resolve): $name" -ForegroundColor Yellow
  }
}

Write-Host ""
Write-Host "=== Terapkan migrasi yang belum jalan ===" -ForegroundColor Cyan
npx prisma migrate deploy
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Selesai. Cek tabel staff_pelanggan_scope:" -ForegroundColor Green
npx tsx scripts/check-db-state.ts
