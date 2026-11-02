ALTER TABLE `portal_tiket` ADD COLUMN `diproses_oleh_id` INTEGER NULL;

CREATE INDEX `portal_tiket_diproses_oleh_id_idx` ON `portal_tiket`(`diproses_oleh_id`);

ALTER TABLE `portal_tiket` ADD CONSTRAINT `portal_tiket_diproses_oleh_id_fkey` FOREIGN KEY (`diproses_oleh_id`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
