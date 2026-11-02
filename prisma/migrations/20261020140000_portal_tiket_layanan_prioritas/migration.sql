-- Nomor layanan dan prioritas pada tiket portal pelanggan.
ALTER TABLE `portal_tiket`
  ADD COLUMN `noLayanan` CHAR(12) NULL,
  ADD COLUMN `prioritas` ENUM('rendah', 'normal', 'tinggi') NOT NULL DEFAULT 'normal';
