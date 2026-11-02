-- AlterTable: source of truth nominal paket untuk tagihan baru (nullable sampai backfill).
ALTER TABLE `Paket` ADD COLUMN `nominal_pembayaran` INTEGER NULL;
