-- Ubah no layanan ke string 12 digit (leading zero)
ALTER TABLE `Pelanggan` ADD COLUMN `noLayananNew` CHAR(12) NULL;

UPDATE `Pelanggan`
SET `noLayananNew` = LPAD(CAST(`noLayanan` AS CHAR), 12, '0');

ALTER TABLE `Pelanggan` DROP INDEX `Pelanggan_noLayanan_key`;
ALTER TABLE `Pelanggan` DROP COLUMN `noLayanan`;
ALTER TABLE `Pelanggan` CHANGE COLUMN `noLayananNew` `noLayanan` CHAR(12) NOT NULL;
CREATE UNIQUE INDEX `Pelanggan_noLayanan_key` ON `Pelanggan`(`noLayanan`);
