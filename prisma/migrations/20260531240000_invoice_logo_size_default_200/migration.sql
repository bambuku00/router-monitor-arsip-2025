-- Default ukuran logo invoice: 200px (sebelumnya 30px).
-- Guarded: aman bila kolom sudah default 200 atau tabel dibuat versi terbaru.
SET @stmt := (
  SELECT IF(COUNT(*) > 0,
    'ALTER TABLE `InvoiceSettings` MODIFY `logoSize` INTEGER NOT NULL DEFAULT 200',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = 'invoicesettings' AND COLUMN_NAME = 'logoSize'
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;

-- Migrasikan nilai lama 30 -> 200 (hanya bila kolom ada).
SET @stmt := (
  SELECT IF(COUNT(*) > 0,
    'UPDATE `InvoiceSettings` SET `logoSize` = 200 WHERE `logoSize` = 30',
    'SELECT 1')
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND LOWER(TABLE_NAME) = 'invoicesettings' AND COLUMN_NAME = 'logoSize'
);
PREPARE s FROM @stmt; EXECUTE s; DEALLOCATE PREPARE s;
