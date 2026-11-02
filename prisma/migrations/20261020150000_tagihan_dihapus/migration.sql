CREATE TABLE `tagihan_dihapus` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pelangganId` INTEGER NOT NULL,
    `period` CHAR(7) NOT NULL,
    `created` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `tagihan_dihapus_period_idx`(`period`),
    UNIQUE INDEX `tagihan_dihapus_pelangganId_period_key`(`pelangganId`, `period`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `tagihan_dihapus` ADD CONSTRAINT `tagihan_dihapus_pelangganId_fkey` FOREIGN KEY (`pelangganId`) REFERENCES `Pelanggan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
