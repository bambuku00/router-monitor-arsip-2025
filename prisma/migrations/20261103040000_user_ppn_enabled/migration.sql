-- Superadmin dapat mematikan PPN (laporan arsip / Komdigi tanpa komponen PPN).
ALTER TABLE `User` ADD COLUMN `ppn_enabled` BOOLEAN NOT NULL DEFAULT true;
