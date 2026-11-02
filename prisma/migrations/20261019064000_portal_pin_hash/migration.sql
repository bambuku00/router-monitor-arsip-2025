-- PIN Portal Pelanggan per mitra (hash, bukan teks pin)
ALTER TABLE `User`
  ADD COLUMN `portal_pin_hash` VARCHAR(255) NULL;
