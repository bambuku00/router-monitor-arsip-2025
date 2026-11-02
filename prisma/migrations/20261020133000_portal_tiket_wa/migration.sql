-- Nomor WhatsApp yang bisa dihubungi pada tiket portal pelanggan.
ALTER TABLE `portal_tiket`
  ADD COLUMN `wa` VARCHAR(20) NULL;
