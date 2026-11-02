-- AlterTable
ALTER TABLE `RegulatoryReport` ALTER COLUMN `updated` DROP DEFAULT;

-- AlterTable
ALTER TABLE `RegulatorySettings` ALTER COLUMN `updated` DROP DEFAULT;

-- AlterTable
ALTER TABLE `settings` MODIFY `id` INTEGER NOT NULL DEFAULT 1;
