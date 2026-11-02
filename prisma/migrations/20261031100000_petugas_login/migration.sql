-- Akun login opsional untuk petugas lapangan.
ALTER TABLE `User` MODIFY `role` ENUM('Superadmin', 'Admin', 'Keuangan', 'Teknisi', 'Client', 'Pending', 'Petugas') NOT NULL;

ALTER TABLE `penagih`
  ADD COLUMN `user_id` INTEGER NULL,
  ADD UNIQUE INDEX `penagih_user_id_key`(`user_id`),
  ADD CONSTRAINT `penagih_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
