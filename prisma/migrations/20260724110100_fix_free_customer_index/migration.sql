-- Align Pelanggan free-customer index name with DB column map (is_free_customer)
CREATE INDEX `Pelanggan_routerId_stop_is_free_customer_idx` ON `Pelanggan`(`routerId`, `stop`, `is_free_customer`);
DROP INDEX `Pelanggan_routerId_stop_isFreeCustomer_idx` ON `Pelanggan`;
