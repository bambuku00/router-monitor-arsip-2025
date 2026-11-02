-- AlterTable
ALTER TABLE `User` ADD COLUMN `staffAllowIsolir` BOOLEAN NULL DEFAULT false,
    ADD COLUMN `staffAllowCancelPayment` BOOLEAN NULL DEFAULT false;
