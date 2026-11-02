CREATE TABLE `penagih` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `owner_user_id` INTEGER NOT NULL,
    `nama` VARCHAR(191) NOT NULL,
    `nomor` VARCHAR(32) NULL,
    `aktif` BOOLEAN NOT NULL DEFAULT true,
    `created` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated` DATETIME(3) NOT NULL,

    INDEX `penagih_owner_user_id_aktif_idx`(`owner_user_id`, `aktif`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `penagih_penugasan` (
    `pelanggan_id` INTEGER NOT NULL,
    `penagih_id` INTEGER NOT NULL,
    `owner_user_id` INTEGER NOT NULL,
    `updated` DATETIME(3) NOT NULL,

    INDEX `penagih_penugasan_penagih_id_idx`(`penagih_id`),
    INDEX `penagih_penugasan_owner_user_id_idx`(`owner_user_id`),
    PRIMARY KEY (`pelanggan_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `penagih_penugasan_log` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pelanggan_id` INTEGER NOT NULL,
    `owner_user_id` INTEGER NOT NULL,
    `dari_penagih_id` INTEGER NULL,
    `ke_penagih_id` INTEGER NULL,
    `actor_user_id` INTEGER NOT NULL,
    `created` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `penagih_penugasan_log_pelanggan_id_created_idx`(`pelanggan_id`, `created`),
    INDEX `penagih_penugasan_log_owner_user_id_created_idx`(`owner_user_id`, `created`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `penagih` ADD CONSTRAINT `penagih_owner_user_id_fkey` FOREIGN KEY (`owner_user_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `penagih_penugasan` ADD CONSTRAINT `penagih_penugasan_pelanggan_id_fkey` FOREIGN KEY (`pelanggan_id`) REFERENCES `Pelanggan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `penagih_penugasan` ADD CONSTRAINT `penagih_penugasan_penagih_id_fkey` FOREIGN KEY (`penagih_id`) REFERENCES `penagih`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `penagih_penugasan_log` ADD CONSTRAINT `penagih_penugasan_log_pelanggan_id_fkey` FOREIGN KEY (`pelanggan_id`) REFERENCES `Pelanggan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `penagih_penugasan_log` ADD CONSTRAINT `penagih_penugasan_log_dari_penagih_id_fkey` FOREIGN KEY (`dari_penagih_id`) REFERENCES `penagih`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `penagih_penugasan_log` ADD CONSTRAINT `penagih_penugasan_log_ke_penagih_id_fkey` FOREIGN KEY (`ke_penagih_id`) REFERENCES `penagih`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
