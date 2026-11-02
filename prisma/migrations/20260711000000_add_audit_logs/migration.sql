-- Audit trail keamanan & operasional (login, pembayaran, isolir, dll.)
CREATE TABLE `audit_logs` (
    `id` BIGINT NOT NULL AUTO_INCREMENT,
    `action` VARCHAR(191) NOT NULL,
    `outcome` VARCHAR(191) NOT NULL,
    `userId` INTEGER NULL,
    `username` VARCHAR(191) NULL,
    `ip` VARCHAR(191) NULL,
    `userAgent` TEXT NULL,
    `endpoint` VARCHAR(191) NULL,
    `reason` VARCHAR(191) NULL,
    `meta` JSON NULL,
    `created` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_action_created_idx`(`action`, `created`),
    INDEX `audit_logs_outcome_created_idx`(`outcome`, `created`),
    INDEX `audit_logs_userId_created_idx`(`userId`, `created`),
    INDEX `audit_logs_created_idx`(`created`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
