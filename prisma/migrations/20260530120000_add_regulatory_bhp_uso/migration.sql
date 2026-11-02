-- CreateEnum (MySQL: use ENUM on columns)
-- RegulatoryCalculationBasis: INVOICE_CREATED | PAYMENT_RECEIVED

CREATE TABLE IF NOT EXISTS `RegulatorySettings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `bhpEnabled` BOOLEAN NOT NULL DEFAULT true,
    `bhpPercent` DOUBLE NOT NULL DEFAULT 0.5,
    `usoEnabled` BOOLEAN NOT NULL DEFAULT true,
    `usoPercent` DOUBLE NOT NULL DEFAULT 1.25,
    `calculationBasis` ENUM('INVOICE_CREATED', 'PAYMENT_RECEIVED') NOT NULL DEFAULT 'INVOICE_CREATED',
    `created` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `RegulatorySettings_userId_key`(`userId`),
    INDEX `RegulatorySettings_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `RegulatoryReport` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `periodMonth` INTEGER NOT NULL,
    `periodYear` INTEGER NOT NULL,
    `grossRevenue` DOUBLE NOT NULL,
    `bhpAmount` DOUBLE NOT NULL DEFAULT 0,
    `usoAmount` DOUBLE NOT NULL DEFAULT 0,
    `totalAmount` DOUBLE NOT NULL DEFAULT 0,
    `calculationBasis` ENUM('INVOICE_CREATED', 'PAYMENT_RECEIVED') NOT NULL,
    `generatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `regulatory_report_periode`(`userId`, `periodYear`, `periodMonth`),
    INDEX `RegulatoryReport_userId_idx`(`userId`),
    INDEX `RegulatoryReport_periodYear_periodMonth_idx`(`periodYear`, `periodMonth`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `RegulatorySettings` ADD CONSTRAINT `RegulatorySettings_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `RegulatoryReport` ADD CONSTRAINT `RegulatoryReport_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
