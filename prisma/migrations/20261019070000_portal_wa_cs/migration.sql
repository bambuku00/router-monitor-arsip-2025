-- Nomor WhatsApp CS untuk Portal Pelanggan. Kosong = tidak ditampilkan.
ALTER TABLE `User`
  ADD COLUMN `portal_wa_cs` VARCHAR(20) NULL;
