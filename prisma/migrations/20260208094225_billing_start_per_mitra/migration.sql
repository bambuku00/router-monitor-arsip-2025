-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nama` VARCHAR(191) NOT NULL,
    `user` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `identitas` ENUM('NIK', 'Paspor') NULL,
    `file_identitas` VARCHAR(191) NULL,
    `no_identitas` VARCHAR(191) NULL,
    `file_npwp` VARCHAR(191) NULL,
    `npwp` VARCHAR(191) NULL,
    `omset` INTEGER NULL,
    `ppn` DOUBLE NULL,
    `parentId` INTEGER NULL,
    `nomor` VARCHAR(191) NULL,
    `alamat` VARCHAR(191) NULL,
    `role` ENUM('Superadmin', 'Admin', 'Keuangan', 'Teknisi', 'Client') NOT NULL,
    `disabled` BOOLEAN NOT NULL DEFAULT false,
    `verified` BOOLEAN NOT NULL DEFAULT true,
    `created` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `billingStartMode` ENUM('NEXT_MONTH', 'IMMEDIATE', 'CUSTOM_DATE') NULL DEFAULT 'NEXT_MONTH',
    `billingStartDate` DATETIME(3) NULL,

    UNIQUE INDEX `User_user_key`(`user`),
    INDEX `User_role_idx`(`role`),
    INDEX `User_parentId_idx`(`parentId`),
    INDEX `User_disabled_idx`(`disabled`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Client` (
    `userId` INTEGER NOT NULL,
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tgl` VARCHAR(191) NOT NULL,
    `nama` VARCHAR(191) NOT NULL,
    `institusi` VARCHAR(191) NOT NULL,
    `kota` VARCHAR(191) NOT NULL,
    `pos` VARCHAR(191) NOT NULL,
    `telepon` VARCHAR(191) NULL,
    `foto` VARCHAR(191) NULL,
    `lat` VARCHAR(191) NULL,
    `lng` VARCHAR(191) NULL,
    `stop` BOOLEAN NOT NULL DEFAULT false,
    `tgl_stop` VARCHAR(191) NULL,
    `deleted` BOOLEAN NOT NULL DEFAULT false,
    `created` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Client_userId_key`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Layanan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nama` VARCHAR(191) NOT NULL,
    `tgl` VARCHAR(191) NOT NULL,
    `kapasitas` VARCHAR(191) NOT NULL,
    `alamat_layanan` VARCHAR(191) NULL,
    `registrasi` INTEGER NOT NULL,
    `bulanan` INTEGER NOT NULL,
    `kontrak` INTEGER NOT NULL,
    `incVat` BOOLEAN NOT NULL,
    `clientId` INTEGER NOT NULL,
    `deleted` BOOLEAN NOT NULL DEFAULT false,
    `created` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClientPerorangan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nama` VARCHAR(191) NOT NULL,
    `orang` ENUM('PJ', 'Teknisi', 'Keuangan') NOT NULL,
    `jabatan` VARCHAR(191) NULL,
    `identitas` ENUM('NIK', 'Paspor') NULL,
    `file_identitas` VARCHAR(191) NULL,
    `no_identitas` VARCHAR(191) NULL,
    `clientId` INTEGER NOT NULL,
    `email` VARCHAR(191) NULL,
    `nomor` VARCHAR(191) NOT NULL,
    `deleted` BOOLEAN NOT NULL DEFAULT false,
    `created` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `perorang_client_jabatan`(`clientId`, `jabatan`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` VARCHAR(191) NOT NULL,
    `userId` INTEGER NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Router` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nama` VARCHAR(191) NOT NULL,
    `host` VARCHAR(191) NOT NULL,
    `port` INTEGER NOT NULL,
    `user` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `lat` VARCHAR(191) NULL,
    `lng` VARCHAR(191) NULL,
    `os_version` VARCHAR(191) NULL,
    `userId` INTEGER NULL,
    `deleted` BOOLEAN NOT NULL DEFAULT false,
    `created` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Router_userId_deleted_idx`(`userId`, `deleted`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Pelanggan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `routerId` INTEGER NOT NULL,
    `nama` VARCHAR(191) NOT NULL,
    `alamat` VARCHAR(191) NOT NULL,
    `nomor` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `foto` VARCHAR(191) NULL,
    `lat` VARCHAR(191) NULL,
    `lng` VARCHAR(191) NULL,
    `tgl` VARCHAR(191) NOT NULL,
    `stop` BOOLEAN NOT NULL DEFAULT false,
    `tgl_stop` VARCHAR(191) NULL,
    `tgl_isolir` INTEGER NULL,
    `ppp_secretId` INTEGER NULL,
    `paketId` INTEGER NOT NULL,
    `created` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Pelanggan_ppp_secretId_key`(`ppp_secretId`),
    INDEX `Pelanggan_routerId_stop_tgl_idx`(`routerId`, `stop`, `tgl`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PppSync` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `routerId` INTEGER NOT NULL,
    `updated` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `PppSync_routerId_key`(`routerId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PppSecret` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `secretId` VARCHAR(191) NOT NULL,
    `routerId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `service` ENUM('any', 'async', 'isdn', 'l2tp', 'pppoe', 'pptp', 'ovpn', 'sstp') NOT NULL,
    `callerId` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `profile` VARCHAR(191) NOT NULL,
    `routes` VARCHAR(191) NOT NULL,
    `ipv6_routes` VARCHAR(191) NOT NULL,
    `limit_bytes_in` VARCHAR(191) NOT NULL,
    `limit_bytes_out` VARCHAR(191) NOT NULL,
    `last_logged_out` VARCHAR(191) NOT NULL,
    `last_callerId` VARCHAR(191) NULL,
    `last_disconnect_reason` VARCHAR(191) NULL,
    `disabled` VARCHAR(191) NOT NULL,
    `comment` VARCHAR(191) NULL,
    `on_router` BOOLEAN NOT NULL DEFAULT true,
    `created` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ppp_secret_name`(`routerId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PppActive` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `activeId` VARCHAR(191) NOT NULL,
    `routerId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `service` ENUM('any', 'async', 'isdn', 'l2tp', 'pppoe', 'pptp', 'ovpn', 'sstp') NOT NULL,
    `callerId` VARCHAR(191) NOT NULL,
    `address` VARCHAR(191) NOT NULL,
    `uptime` VARCHAR(191) NOT NULL,
    `encoding` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `limit_bytes_in` VARCHAR(191) NOT NULL,
    `limit_bytes_out` VARCHAR(191) NOT NULL,
    `radius` VARCHAR(191) NOT NULL,
    `comment` VARCHAR(191) NULL,
    `created` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ppp_active_name`(`routerId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Paket` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nama` VARCHAR(191) NOT NULL,
    `kapasitas` DOUBLE NOT NULL,
    `harga` INTEGER NOT NULL,
    `deleted` BOOLEAN NOT NULL DEFAULT false,
    `created` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Bank` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bank` VARCHAR(191) NOT NULL,
    `norek` VARCHAR(191) NOT NULL,
    `nama` VARCHAR(191) NOT NULL,
    `deleted` BOOLEAN NOT NULL DEFAULT false,
    `created` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `userId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Pembayaran` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `inputterId` INTEGER NULL,
    `pelangganId` INTEGER NOT NULL,
    `paketId` INTEGER NOT NULL,
    `jatuh_tempo` VARCHAR(191) NOT NULL,
    `total` DOUBLE NOT NULL,
    `bankId` INTEGER NULL,
    `metode` ENUM('Transfer', 'Cash') NULL,
    `nonaktif` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('Terbayar', 'Belum') NOT NULL DEFAULT 'Belum',
    `created` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Pembayaran_pelangganId_idx`(`pelangganId`),
    INDEX `Pembayaran_jatuh_tempo_status_idx`(`jatuh_tempo`, `status`),
    UNIQUE INDEX `pelanggan_perbulan`(`pelangganId`, `jatuh_tempo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LogBayar` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pembayaranId` INTEGER NOT NULL,
    `total` DOUBLE NOT NULL,
    `metode` ENUM('Transfer', 'Cash') NULL,
    `status` ENUM('Terbayar', 'Belum') NOT NULL,
    `inputterId` INTEGER NOT NULL,
    `created` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PembayaranMitra` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `tanggal` VARCHAR(191) NOT NULL,
    `paid` DOUBLE NOT NULL,
    `total` DOUBLE NOT NULL,
    `metode` ENUM('Transfer', 'Cash') NULL,
    `bankId` INTEGER NULL,
    `status` ENUM('Terbayar', 'Belum') NOT NULL DEFAULT 'Belum',
    `created` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `mitraclient_perbulan`(`userId`, `tanggal`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `LogBayarMitra` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pembayaranId` INTEGER NOT NULL,
    `paid` DOUBLE NOT NULL,
    `metode` ENUM('Transfer', 'Cash') NULL,
    `status` ENUM('Terbayar', 'Belum') NOT NULL,
    `created` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Province` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nama` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `Province_nama_key`(`nama`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Regency` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nama` VARCHAR(191) NOT NULL,
    `provinceId` INTEGER NOT NULL,

    UNIQUE INDEX `Regency_nama_key`(`nama`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Kodepos` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(191) NOT NULL,
    `regencyId` INTEGER NOT NULL,

    UNIQUE INDEX `Kodepos_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Pengeluaran` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `keterangan` VARCHAR(191) NOT NULL,
    `nominal` DOUBLE NOT NULL,
    `tanggal` DATETIME(3) NOT NULL,
    `userId` INTEGER NULL,
    `created` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Client` ADD CONSTRAINT `Client_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Layanan` ADD CONSTRAINT `Layanan_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClientPerorangan` ADD CONSTRAINT `ClientPerorangan_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Router` ADD CONSTRAINT `Router_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Pelanggan` ADD CONSTRAINT `Pelanggan_ppp_secretId_fkey` FOREIGN KEY (`ppp_secretId`) REFERENCES `PppSecret`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Pelanggan` ADD CONSTRAINT `Pelanggan_paketId_fkey` FOREIGN KEY (`paketId`) REFERENCES `Paket`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Pelanggan` ADD CONSTRAINT `Pelanggan_routerId_fkey` FOREIGN KEY (`routerId`) REFERENCES `Router`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PppSecret` ADD CONSTRAINT `PppSecret_routerId_fkey` FOREIGN KEY (`routerId`) REFERENCES `Router`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PppActive` ADD CONSTRAINT `PppActive_routerId_fkey` FOREIGN KEY (`routerId`) REFERENCES `Router`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PppActive` ADD CONSTRAINT `PppActive_routerId_name_fkey` FOREIGN KEY (`routerId`, `name`) REFERENCES `PppSecret`(`routerId`, `name`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Paket` ADD CONSTRAINT `Paket_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Bank` ADD CONSTRAINT `Bank_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Pembayaran` ADD CONSTRAINT `Pembayaran_pelangganId_fkey` FOREIGN KEY (`pelangganId`) REFERENCES `Pelanggan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Pembayaran` ADD CONSTRAINT `Pembayaran_paketId_fkey` FOREIGN KEY (`paketId`) REFERENCES `Paket`(`id`) ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Pembayaran` ADD CONSTRAINT `Pembayaran_bankId_fkey` FOREIGN KEY (`bankId`) REFERENCES `Bank`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LogBayar` ADD CONSTRAINT `LogBayar_pembayaranId_fkey` FOREIGN KEY (`pembayaranId`) REFERENCES `Pembayaran`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LogBayar` ADD CONSTRAINT `LogBayar_inputterId_fkey` FOREIGN KEY (`inputterId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PembayaranMitra` ADD CONSTRAINT `PembayaranMitra_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PembayaranMitra` ADD CONSTRAINT `PembayaranMitra_bankId_fkey` FOREIGN KEY (`bankId`) REFERENCES `Bank`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `LogBayarMitra` ADD CONSTRAINT `LogBayarMitra_pembayaranId_fkey` FOREIGN KEY (`pembayaranId`) REFERENCES `PembayaranMitra`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Regency` ADD CONSTRAINT `Regency_provinceId_fkey` FOREIGN KEY (`provinceId`) REFERENCES `Province`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Kodepos` ADD CONSTRAINT `Kodepos_regencyId_fkey` FOREIGN KEY (`regencyId`) REFERENCES `Regency`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Pengeluaran` ADD CONSTRAINT `Pengeluaran_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
