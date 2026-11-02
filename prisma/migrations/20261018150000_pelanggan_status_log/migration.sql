CREATE TABLE `pelanggan_status_logs` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `pelangganId` INTEGER NOT NULL,
  `action` ENUM('stop', 'resume') NOT NULL,
  `executedBy` VARCHAR(191) NOT NULL,
  `created` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `pelanggan_status_logs_pelangganId_created_idx`(`pelangganId`, `created`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `pelanggan_status_logs` ADD CONSTRAINT `pelanggan_status_logs_pelangganId_fkey` FOREIGN KEY (`pelangganId`) REFERENCES `Pelanggan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
