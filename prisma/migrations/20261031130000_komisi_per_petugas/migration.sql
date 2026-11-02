-- Tarif komisi ditentukan per petugas, bukan per pelanggan.
ALTER TABLE `penagih`
  ADD COLUMN `komisi_nominal` INTEGER NOT NULL DEFAULT 0;

ALTER TABLE `Pelanggan`
  DROP COLUMN `komisi_nominal`;
