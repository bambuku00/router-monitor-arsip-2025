ALTER TABLE `portal_bersama`
    ADD COLUMN `kontak_mode` VARCHAR(8) NOT NULL DEFAULT 'beda',
    ADD COLUMN `pin_hash` VARCHAR(255) NULL,
    ADD COLUMN `wa_cs` VARCHAR(20) NULL;
