-- AlterTable
ALTER TABLE `User` MODIFY `role` ENUM('Superadmin', 'Admin', 'Keuangan', 'Teknisi', 'Client', 'Pending') NOT NULL;

-- CreateIndex
CREATE INDEX `Pengeluaran_tanggal_idx` ON `Pengeluaran`(`tanggal`);

-- RedefineIndex
CREATE INDEX `Bank_userId_idx` ON `Bank`(`userId`);
-- DROP INDEX IF EXISTS `Bank_userId_fkey` ON `Bank`;

-- RedefineIndex
CREATE INDEX `LogBayar_inputterId_idx` ON `LogBayar`(`inputterId`);
-- DROP INDEX `LogBayar_inputterId_fkey` ON `LogBayar`;

-- RedefineIndex
CREATE INDEX `LogBayar_pembayaranId_idx` ON `LogBayar`(`pembayaranId`);
-- DROP INDEX `LogBayar_pembayaranId_fkey` ON `LogBayar`;

-- RedefineIndex
CREATE INDEX `LogBayarMitra_pembayaranId_idx` ON `LogBayarMitra`(`pembayaranId`);
-- DROP INDEX `LogBayarMitra_pembayaranId_fkey` ON `LogBayarMitra`;

-- RedefineIndex
CREATE INDEX `Pengeluaran_userId_idx` ON `Pengeluaran`(`userId`);
-- DROP INDEX `Pengeluaran_userId_fkey` ON `Pengeluaran`;
