-- AlterTable
ALTER TABLE `Pelanggan` ADD COLUMN `noLayanan` VARCHAR(191) NULL;

-- Isi dari username PPP yang sudah terhubung
UPDATE `Pelanggan` p
INNER JOIN `PppSecret` s ON p.`ppp_secretId` = s.`id`
SET p.`noLayanan` = s.`name`
WHERE p.`noLayanan` IS NULL OR TRIM(p.`noLayanan`) = '';
