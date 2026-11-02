-- Hapus nilai lama (username PPP) lalu ubah ke angka unik global
ALTER TABLE `Pelanggan` ADD COLUMN `noLayananNew` INT NULL;

SET @n := 0;
UPDATE `Pelanggan` SET `noLayananNew` = (@n := @n + 1) ORDER BY `id`;

ALTER TABLE `Pelanggan` DROP COLUMN `noLayanan`;
ALTER TABLE `Pelanggan` CHANGE COLUMN `noLayananNew` `noLayanan` INT NOT NULL;
CREATE UNIQUE INDEX `Pelanggan_noLayanan_key` ON `Pelanggan`(`noLayanan`);
