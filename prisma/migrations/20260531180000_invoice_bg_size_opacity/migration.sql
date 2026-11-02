-- =============================================================================
-- InvoiceSettings: watermark size/opacity (bgSizeMm, bgOpacity) + drop bgPosition.
--
-- PERBAIKAN (recovery): Migration versi lama langsung `ALTER TABLE InvoiceSettings`
-- padahal tabel tidak pernah dibuat oleh migration mana pun (proyek di-bootstrap
-- via `prisma db push`, bukan migration lengkap). Akibatnya di database yang hanya
-- memakai `migrate deploy` (mis. production) tabel tidak ada -> P3018 / MySQL 1146.
--
-- Versi ini IDEMPOTENT & SELF-HEALING:
--   * Membuat tabel `InvoiceSettings` lengkap (struktur final) bila belum ada.
--   * Merekonsiliasi tabel lama (hasil db push) yang masih punya `bgPosition`
--     dan belum punya `bgSizeMm`/`bgOpacity`.
--   * Memastikan unique index userId + index + foreign key ke User(id).
--   * Aman dijalankan ulang; tidak menghapus data existing.
--
-- Nama tabel canonical: `InvoiceSettings` (PascalCase, tanpa @@map) — konsisten
-- dengan tabel lain (User, Router, dst). Pengecekan INFORMATION_SCHEMA memakai
-- LOWER(TABLE_NAME) agar cocok di Windows (lower_case_table_names=1) maupun Linux.
-- =============================================================================

-- 1) Buat tabel bila belum ada (struktur final sesuai schema terbaru).
CREATE TABLE IF NOT EXISTS `InvoiceSettings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `logoSize` INTEGER NOT NULL DEFAULT 200,
    `logoFilename` VARCHAR(191) NULL,
    `qrFilename` VARCHAR(191) NULL,
    `bgFilename` VARCHAR(191) NULL,
    `bgWatermark` BOOLEAN NOT NULL DEFAULT true,
    `bgSizeMm` INTEGER NOT NULL DEFAULT 220,
    `bgOpacity` INTEGER NOT NULL DEFAULT 40,
    `companyName` VARCHAR(191) NOT NULL DEFAULT 'PT. WAHYU ADIDAYA NETWORK',
    `companySlogan` VARCHAR(191) NOT NULL DEFAULT 'Internet Service Provider',
    `companyAddress1` VARCHAR(191) NOT NULL DEFAULT 'JLN RADEN WIJAYA RT 001 RW 003 GIRI',
    `companyAddress2` VARCHAR(191) NOT NULL DEFAULT 'BANYUWANGI',
    `companyAddress3` VARCHAR(191) NOT NULL DEFAULT 'KODE POS 68423',
    `signatureName` VARCHAR(191) NOT NULL DEFAULT 'admin',
    `signaturePosition` VARCHAR(191) NOT NULL DEFAULT 'Finance',
    -- Catatan: kolom TEXT TANPA DEFAULT. MySQL < 8.0.13 menolak DEFAULT pada
    -- BLOB/TEXT (error 1101). Nilai default disediakan di layer aplikasi
    -- (lib/invoice-settings.ts upsert selalu mengisi kolom ini), jadi NOT NULL aman.
    `cashPaymentNote` TEXT NOT NULL,
    `confirmationNumber` VARCHAR(191) NOT NULL DEFAULT '0822-3299-7497',
    `paymentNotes` TEXT NOT NULL,
    `tandaTerima` TEXT NOT NULL,
    `ucapanLunas` TEXT NOT NULL,
    `footerText` VARCHAR(191) NOT NULL DEFAULT 'SUPPORT BY : WINET - ISP BILLING SYSTEM',
    `ppnStatus` BOOLEAN NOT NULL DEFAULT true,
    `ppnValue` DOUBLE NOT NULL DEFAULT 11,
    `ppnCalculationMode` VARCHAR(191) NOT NULL DEFAULT 'after',
    `discountStatus` BOOLEAN NOT NULL DEFAULT false,
    `discountType` VARCHAR(191) NOT NULL DEFAULT 'fixed',
    `discountValue` DOUBLE NOT NULL DEFAULT 0,
    `created` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated` DATETIME(3) NOT NULL,

    UNIQUE INDEX `InvoiceSettings_userId_key`(`userId`),
    INDEX `InvoiceSettings_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2) Rekonsiliasi tabel lama (db push): tambah bgSizeMm bila belum ada.
SET @stmt := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `InvoiceSettings` ADD COLUMN `bgSizeMm` INTEGER NOT NULL DEFAULT 220',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = 'invoicesettings' AND COLUMN_NAME = 'bgSizeMm'
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- 3) Tambah bgOpacity bila belum ada.
SET @stmt := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `InvoiceSettings` ADD COLUMN `bgOpacity` INTEGER NOT NULL DEFAULT 40',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = 'invoicesettings' AND COLUMN_NAME = 'bgOpacity'
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- 4) Hapus kolom lama bgPosition bila masih ada.
SET @stmt := (
  SELECT IF(COUNT(*) > 0,
    'ALTER TABLE `InvoiceSettings` DROP COLUMN `bgPosition`',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = 'invoicesettings' AND COLUMN_NAME = 'bgPosition'
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- 5) Pastikan default logoSize = 200 (tabel lama mungkin masih 30).
SET @stmt := (
  SELECT IF(COUNT(*) > 0,
    'ALTER TABLE `InvoiceSettings` MODIFY `logoSize` INTEGER NOT NULL DEFAULT 200',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = 'invoicesettings' AND COLUMN_NAME = 'logoSize'
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- 6) Pastikan unique index userId ada.
SET @stmt := (
  SELECT IF(COUNT(*) = 0,
    'CREATE UNIQUE INDEX `InvoiceSettings_userId_key` ON `InvoiceSettings`(`userId`)',
    'SELECT 1')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = 'invoicesettings' AND INDEX_NAME = 'InvoiceSettings_userId_key'
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- 7) Pastikan index userId ada.
SET @stmt := (
  SELECT IF(COUNT(*) = 0,
    'CREATE INDEX `InvoiceSettings_userId_idx` ON `InvoiceSettings`(`userId`)',
    'SELECT 1')
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = 'invoicesettings' AND INDEX_NAME = 'InvoiceSettings_userId_idx'
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- 8) Pastikan foreign key ke User(id) ada.
SET @stmt := (
  SELECT IF(COUNT(*) = 0,
    'ALTER TABLE `InvoiceSettings` ADD CONSTRAINT `InvoiceSettings_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE',
    'SELECT 1')
  FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = 'invoicesettings'
    AND CONSTRAINT_NAME = 'InvoiceSettings_userId_fkey' AND CONSTRAINT_TYPE = 'FOREIGN KEY'
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;
