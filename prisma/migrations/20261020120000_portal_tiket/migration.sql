-- Tiket keluhan / lainnya dari Portal Pelanggan.
CREATE TABLE `portal_tiket` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `pelangganId` INTEGER NOT NULL,
  `userId` INTEGER NOT NULL,
  `kategori` ENUM('keluhan', 'lainnya') NOT NULL,
  `judul` VARCHAR(120) NOT NULL,
  `pesan` TEXT NOT NULL,
  `status` ENUM('baru', 'diproses', 'selesai') NOT NULL DEFAULT 'baru',
  `balasan` TEXT NULL,
  `created` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated` DATETIME(3) NOT NULL,

  INDEX `portal_tiket_pelangganId_created_idx`(`pelangganId`, `created`),
  INDEX `portal_tiket_userId_status_created_idx`(`userId`, `status`, `created`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `portal_tiket` ADD CONSTRAINT `portal_tiket_pelangganId_fkey` FOREIGN KEY (`pelangganId`) REFERENCES `Pelanggan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `portal_tiket` ADD CONSTRAINT `portal_tiket_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
