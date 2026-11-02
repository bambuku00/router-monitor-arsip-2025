ALTER TABLE `penagih_penugasan_log` ADD COLUMN `dari_nama` VARCHAR(191) NULL;
ALTER TABLE `penagih_penugasan_log` ADD COLUMN `ke_nama` VARCHAR(191) NULL;

UPDATE `penagih_penugasan_log` AS log
INNER JOIN `penagih` AS petugas ON petugas.`id` = log.`dari_penagih_id`
SET log.`dari_nama` = petugas.`nama`
WHERE log.`dari_nama` IS NULL;

UPDATE `penagih_penugasan_log` AS log
INNER JOIN `penagih` AS petugas ON petugas.`id` = log.`ke_penagih_id`
SET log.`ke_nama` = petugas.`nama`
WHERE log.`ke_nama` IS NULL;

ALTER TABLE `penagih_penugasan` DROP FOREIGN KEY `penagih_penugasan_penagih_id_fkey`;
ALTER TABLE `penagih_penugasan` ADD CONSTRAINT `penagih_penugasan_penagih_id_fkey` FOREIGN KEY (`penagih_id`) REFERENCES `penagih`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `penagih_penugasan_log` DROP FOREIGN KEY `penagih_penugasan_log_dari_penagih_id_fkey`;
ALTER TABLE `penagih_penugasan_log` ADD CONSTRAINT `penagih_penugasan_log_dari_penagih_id_fkey` FOREIGN KEY (`dari_penagih_id`) REFERENCES `penagih`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `penagih_penugasan_log` DROP FOREIGN KEY `penagih_penugasan_log_ke_penagih_id_fkey`;
ALTER TABLE `penagih_penugasan_log` ADD CONSTRAINT `penagih_penugasan_log_ke_penagih_id_fkey` FOREIGN KEY (`ke_penagih_id`) REFERENCES `penagih`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
