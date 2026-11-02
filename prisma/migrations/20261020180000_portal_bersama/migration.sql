CREATE TABLE `portal_bersama` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nama` VARCHAR(80) NOT NULL,
    `slug` VARCHAR(32) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `created` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated` DATETIME(3) NOT NULL,

    UNIQUE INDEX `portal_bersama_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `portal_bersama_mitra` (
    `portalId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,

    INDEX `portal_bersama_mitra_userId_idx`(`userId`),
    PRIMARY KEY (`portalId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `portal_bersama_mitra` ADD CONSTRAINT `portal_bersama_mitra_portalId_fkey` FOREIGN KEY (`portalId`) REFERENCES `portal_bersama`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `portal_bersama_mitra` ADD CONSTRAINT `portal_bersama_mitra_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
