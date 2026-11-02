-- Metode bagi hasil per mitra: INVOICE (default, aman untuk data lama) atau PAID.
ALTER TABLE `User`
  ADD COLUMN `revenueBasis` ENUM('INVOICE', 'PAID') NOT NULL DEFAULT 'INVOICE';
