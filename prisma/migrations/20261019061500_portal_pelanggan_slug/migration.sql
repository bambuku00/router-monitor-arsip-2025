-- Link Portal Pelanggan per mitra
ALTER TABLE `User`
  ADD COLUMN `portal_slug` VARCHAR(32) NULL,
  ADD UNIQUE INDEX `User_portal_slug_key` (`portal_slug`);
