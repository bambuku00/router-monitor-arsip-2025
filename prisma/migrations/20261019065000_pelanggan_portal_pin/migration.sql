-- PIN login portal per pelanggan. Kosong = pakai PIN mitra.
ALTER TABLE `Pelanggan`
  ADD COLUMN `portal_pin_hash` VARCHAR(255) NULL;
