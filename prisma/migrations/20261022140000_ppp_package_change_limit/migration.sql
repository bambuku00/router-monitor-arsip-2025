-- Batas bulanan upgrade/downgrade per mitra. NULL = tidak dibatasi.
ALTER TABLE `User` ADD COLUMN `ppp_package_change_limit` INTEGER NULL;

CREATE TABLE `ppp_package_change` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `pppSecretId` INTEGER NOT NULL,
  `pelangganId` INTEGER NOT NULL,
  `routerId` INTEGER NOT NULL,
  `ownerUserId` INTEGER NOT NULL,
  `actorUserId` INTEGER NOT NULL,
  `actorRole` ENUM('Superadmin', 'Admin', 'Keuangan', 'Teknisi', 'Client', 'Pending') NOT NULL,
  `direction` VARCHAR(16) NOT NULL,
  `created` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `ppp_package_change_ownerUserId_created_idx`(`ownerUserId`, `created`),
  INDEX `ppp_package_change_pppSecretId_created_idx`(`pppSecretId`, `created`),
  INDEX `ppp_package_change_routerId_created_idx`(`routerId`, `created`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ppp_package_change` ADD CONSTRAINT `ppp_package_change_pppSecretId_fkey` FOREIGN KEY (`pppSecretId`) REFERENCES `PppSecret`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
