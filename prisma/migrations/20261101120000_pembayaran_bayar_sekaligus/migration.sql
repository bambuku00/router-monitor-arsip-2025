-- Catatan pembayaran beberapa bulan sekaligus (Admin/Keuangan).
ALTER TABLE `Pembayaran`
  ADD COLUMN `bayar_sekaligus` INTEGER NULL;
