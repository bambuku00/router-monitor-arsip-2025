CREATE TABLE `paket_router` (
    `paketId` INTEGER NOT NULL,
    `routerId` INTEGER NOT NULL,

    INDEX `paket_router_routerId_idx`(`routerId`),
    PRIMARY KEY (`paketId`, `routerId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `paket_router` ADD CONSTRAINT `paket_router_paketId_fkey` FOREIGN KEY (`paketId`) REFERENCES `Paket`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `paket_router` ADD CONSTRAINT `paket_router_routerId_fkey` FOREIGN KEY (`routerId`) REFERENCES `Router`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
