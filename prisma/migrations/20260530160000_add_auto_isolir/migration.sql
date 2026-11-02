-- CreateTable
CREATE TABLE `AutoIsolirSettings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT false,
    `toleranceDays` INTEGER NOT NULL DEFAULT 1,
    `executeTime` VARCHAR(191) NOT NULL DEFAULT '00:10',
    `isolirProfileName` VARCHAR(191) NOT NULL DEFAULT 'ISOLIR',
    `onlyActiveCustomers` BOOLEAN NOT NULL DEFAULT true,
    `notifyBefore` BOOLEAN NOT NULL DEFAULT false,
    `notifyAfter` BOOLEAN NOT NULL DEFAULT false,
    `autoRestoreOnPayment` BOOLEAN NOT NULL DEFAULT true,
    `created` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated` DATETIME(3) NOT NULL,

    UNIQUE INDEX `AutoIsolirSettings_userId_key`(`userId`),
    INDEX `AutoIsolirSettings_userId_enabled_idx`(`userId`, `enabled`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AutoIsolirLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `pelangganId` INTEGER NULL,
    `pembayaranId` INTEGER NULL,
    `pppUsername` VARCHAR(191) NULL,
    `routerId` INTEGER NULL,
    `dueDate` VARCHAR(191) NULL,
    `oldProfile` VARCHAR(191) NULL,
    `newProfile` VARCHAR(191) NULL,
    `action` ENUM('isolate', 'restore') NOT NULL DEFAULT 'isolate',
    `status` ENUM('success', 'failed', 'skipped') NOT NULL,
    `errorMessage` TEXT NULL,
    `executedBy` VARCHAR(191) NOT NULL DEFAULT 'system',
    `dryRun` BOOLEAN NOT NULL DEFAULT false,
    `batchId` VARCHAR(191) NULL,
    `created` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AutoIsolirLog_userId_created_idx`(`userId`, `created`),
    INDEX `AutoIsolirLog_status_idx`(`status`),
    INDEX `AutoIsolirLog_batchId_idx`(`batchId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `JobLock` (
    `name` VARCHAR(191) NOT NULL,
    `lockedAt` DATETIME(3) NOT NULL,
    `lockedUntil` DATETIME(3) NOT NULL,
    `owner` VARCHAR(191) NULL,

    PRIMARY KEY (`name`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AutoIsolirSettings` ADD CONSTRAINT `AutoIsolirSettings_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AutoIsolirLog` ADD CONSTRAINT `AutoIsolirLog_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AutoIsolirLog` ADD CONSTRAINT `AutoIsolirLog_pelangganId_fkey` FOREIGN KEY (`pelangganId`) REFERENCES `Pelanggan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AutoIsolirLog` ADD CONSTRAINT `AutoIsolirLog_pembayaranId_fkey` FOREIGN KEY (`pembayaranId`) REFERENCES `Pembayaran`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AutoIsolirLog` ADD CONSTRAINT `AutoIsolirLog_routerId_fkey` FOREIGN KEY (`routerId`) REFERENCES `Router`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
