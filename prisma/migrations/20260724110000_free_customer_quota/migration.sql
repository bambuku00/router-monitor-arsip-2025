-- Kuota pelanggan gratis per mitra (NULL = unlimited, backward compatible)
ALTER TABLE `User` ADD COLUMN `free_customer_limit` INTEGER NULL;

-- Penanda pelanggan gratis eksplisit (bukan hanya tagihan Rp0)
ALTER TABLE `Pelanggan` ADD COLUMN `is_free_customer` BOOLEAN NOT NULL DEFAULT false;

-- Backfill: pelanggan aktif dengan paket harga 0 dianggap gratis (perilaku lama)
UPDATE `Pelanggan` p
INNER JOIN `Paket` pk ON p.`paketId` = pk.`id`
SET p.`is_free_customer` = true
WHERE p.`stop` = false
  AND p.`ppp_secretId` IS NOT NULL
  AND pk.`harga` <= 0;

CREATE INDEX `Pelanggan_routerId_stop_isFreeCustomer_idx` ON `Pelanggan`(`routerId`, `stop`, `is_free_customer`);
