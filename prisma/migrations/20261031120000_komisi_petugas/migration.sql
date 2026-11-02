-- Tarif komisi per pelanggan dan ledger komisi petugas.
ALTER TABLE `Pelanggan`
  ADD COLUMN `komisi_nominal` INTEGER NOT NULL DEFAULT 0;

CREATE TABLE `komisi_petugas_entri` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `owner_user_id` INTEGER NOT NULL,
  `penagih_id` INTEGER NOT NULL,
  `actor_user_id` INTEGER NOT NULL,
  `pelanggan_id` INTEGER NOT NULL,
  `pembayaran_id` INTEGER NOT NULL,
  `log_bayar_id` INTEGER NULL,
  `reverses_id` INTEGER NULL,
  `nominal` INTEGER NOT NULL,
  `created` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `komisi_petugas_entri_log_bayar_id_key`(`log_bayar_id`),
  UNIQUE INDEX `komisi_petugas_entri_reverses_id_key`(`reverses_id`),
  INDEX `komisi_petugas_entri_penagih_id_created_idx`(`penagih_id`, `created`),
  INDEX `komisi_petugas_entri_pembayaran_id_idx`(`pembayaran_id`),
  INDEX `komisi_petugas_entri_owner_user_id_created_idx`(`owner_user_id`, `created`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `komisi_petugas_entri`
  ADD CONSTRAINT `komisi_petugas_entri_penagih_id_fkey`
    FOREIGN KEY (`penagih_id`) REFERENCES `penagih`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `komisi_petugas_entri_actor_user_id_fkey`
    FOREIGN KEY (`actor_user_id`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `komisi_petugas_entri_pelanggan_id_fkey`
    FOREIGN KEY (`pelanggan_id`) REFERENCES `Pelanggan`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `komisi_petugas_entri_pembayaran_id_fkey`
    FOREIGN KEY (`pembayaran_id`) REFERENCES `Pembayaran`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `komisi_petugas_entri_log_bayar_id_fkey`
    FOREIGN KEY (`log_bayar_id`) REFERENCES `LogBayar`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `komisi_petugas_entri_reverses_id_fkey`
    FOREIGN KEY (`reverses_id`) REFERENCES `komisi_petugas_entri`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
