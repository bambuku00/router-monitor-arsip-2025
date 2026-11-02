-- Portal Pelanggan per mitra (default mati)
ALTER TABLE `User`
  ADD COLUMN `portal_pelanggan_enabled` BOOLEAN NOT NULL DEFAULT false;
