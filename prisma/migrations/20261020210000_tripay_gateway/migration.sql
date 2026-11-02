CREATE TABLE `tripay_gateway` (
    `userId` INTEGER NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `sandbox` BOOLEAN NOT NULL DEFAULT true,
    `merchant_code` VARCHAR(32) NOT NULL DEFAULT '',
    `api_key` TEXT NOT NULL,
    `private_key` TEXT NOT NULL,
    `created` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated` DATETIME(3) NOT NULL,

    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `tripay_transaksi` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pembayaranId` INTEGER NOT NULL,
    `merchant_ref` VARCHAR(50) NOT NULL,
    `reference` VARCHAR(64) NULL,
    `checkout_url` TEXT NULL,
    `amount` INTEGER NOT NULL,
    `status` VARCHAR(16) NOT NULL DEFAULT 'UNPAID',
    `created` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tripay_transaksi_merchant_ref_key`(`merchant_ref`),
    INDEX `tripay_transaksi_pembayaranId_idx`(`pembayaranId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `tripay_gateway` ADD CONSTRAINT `tripay_gateway_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `tripay_transaksi` ADD CONSTRAINT `tripay_transaksi_pembayaranId_fkey` FOREIGN KEY (`pembayaranId`) REFERENCES `Pembayaran`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
