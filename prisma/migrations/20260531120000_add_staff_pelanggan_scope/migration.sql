-- CreateTable
CREATE TABLE `staff_pelanggan_scope` (
    `staff_user_id` INTEGER NOT NULL,
    `pelanggan_id` INTEGER NOT NULL,
    `created` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `staff_pelanggan_scope_pelanggan_id_idx`(`pelanggan_id`),
    PRIMARY KEY (`staff_user_id`, `pelanggan_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `staff_pelanggan_scope` ADD CONSTRAINT `staff_pelanggan_scope_staff_user_id_fkey` FOREIGN KEY (`staff_user_id`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `staff_pelanggan_scope` ADD CONSTRAINT `staff_pelanggan_scope_pelanggan_id_fkey` FOREIGN KEY (`pelanggan_id`) REFERENCES `Pelanggan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
