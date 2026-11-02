CREATE TABLE `ppp_booster` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `pppSecretId` INTEGER NOT NULL,
  `routerId` INTEGER NOT NULL,
  `previousProfile` VARCHAR(191) NOT NULL,
  `boosterProfile` VARCHAR(191) NOT NULL,
  `days` INTEGER NOT NULL,
  `endsAt` DATETIME(3) NOT NULL,
  `restoredAt` DATETIME(3) NULL,
  `actorUserId` INTEGER NOT NULL,
  `created` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `ppp_booster_routerId_restoredAt_endsAt_idx`(`routerId`, `restoredAt`, `endsAt`),
  INDEX `ppp_booster_pppSecretId_restoredAt_idx`(`pppSecretId`, `restoredAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `ppp_booster` ADD CONSTRAINT `ppp_booster_pppSecretId_fkey` FOREIGN KEY (`pppSecretId`) REFERENCES `PppSecret`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
