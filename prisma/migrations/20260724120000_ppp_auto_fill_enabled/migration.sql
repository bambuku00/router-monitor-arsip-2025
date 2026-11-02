-- Auto Isi pelanggan dari PPP per mitra (default off untuk mitra lama)
ALTER TABLE `User` ADD COLUMN `ppp_auto_fill_enabled` BOOLEAN NOT NULL DEFAULT false;
