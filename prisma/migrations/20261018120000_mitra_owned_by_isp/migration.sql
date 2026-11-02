-- AlterTable
ALTER TABLE `User`
  ADD COLUMN `owned_by_isp` BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN `revenue_share_enabled` BOOLEAN NOT NULL DEFAULT true;
