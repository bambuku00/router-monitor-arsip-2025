-- Extend PppSync metadata for background/manual/auto sync tracking
ALTER TABLE `PppSync`
  ADD COLUMN `lastSyncStartedAt` DATETIME(3) NULL,
  ADD COLUMN `lastSyncCompletedAt` DATETIME(3) NULL,
  ADD COLUMN `lastSyncStatus` ENUM('success', 'partial', 'failed', 'skipped') NULL,
  ADD COLUMN `lastSyncError` TEXT NULL,
  ADD COLUMN `lastSyncSecrets` INT NULL,
  ADD COLUMN `lastSyncActives` INT NULL,
  ADD COLUMN `syncInProgress` BOOLEAN NOT NULL DEFAULT false;
