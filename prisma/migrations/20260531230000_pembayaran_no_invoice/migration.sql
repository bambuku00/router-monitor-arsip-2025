ALTER TABLE `Pembayaran` ADD COLUMN `noInvoice` CHAR(6) NULL;

SET @n := 0;
UPDATE `Pembayaran` SET `noInvoice` = LPAD((@n := @n + 1), 6, '0') ORDER BY `id`;

ALTER TABLE `Pembayaran` MODIFY `noInvoice` CHAR(6) NOT NULL;
CREATE UNIQUE INDEX `Pembayaran_noInvoice_key` ON `Pembayaran`(`noInvoice`);
