-- AlterTable
ALTER TABLE `Router` ADD COLUMN `isolirProfileName` VARCHAR(191) NULL,
    ADD COLUMN `isolirGatewayIp` VARCHAR(191) NULL,
    ADD COLUMN `isolirRosType` VARCHAR(191) NULL,
    ADD COLUMN `isolirConfiguredAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `PppSecret` ADD COLUMN `isIsolir` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `profileBeforeIsolir` VARCHAR(191) NULL;
