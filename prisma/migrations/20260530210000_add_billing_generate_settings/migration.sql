-- Pengaturan global generate tagihan
CREATE TABLE `settings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `billing_generate_day` INTEGER NOT NULL DEFAULT 25,
    `billing_generate_hour` INTEGER NOT NULL DEFAULT 1,
    `updated` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `settings` (`id`, `billing_generate_day`, `billing_generate_hour`, `updated`)
VALUES (1, 25, 1, CURRENT_TIMESTAMP(3));

-- Override tanggal generate per mitra (Admin)
ALTER TABLE `User` ADD COLUMN `billing_generate_day` INTEGER NULL;

-- Log generate tagihan per mitra & periode
CREATE TABLE `billing_generate_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `client_id` INTEGER NOT NULL,
    `period` VARCHAR(191) NOT NULL,
    `status` ENUM('success', 'failed', 'skipped') NOT NULL,
    `invoiceCount` INTEGER NOT NULL DEFAULT 0,
    `message` TEXT NULL,
    `generated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `billing_generate_logs_period_idx`(`period`),
    INDEX `billing_generate_logs_generated_at_idx`(`generated_at`),
    UNIQUE INDEX `billing_generate_logs_client_id_period_key`(`client_id`, `period`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `billing_generate_logs` ADD CONSTRAINT `billing_generate_logs_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
