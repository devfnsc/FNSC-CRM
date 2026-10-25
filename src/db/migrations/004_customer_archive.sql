ALTER TABLE customers
  ADD COLUMN archived_at TIMESTAMP NULL DEFAULT NULL,
  ADD KEY customers_archived_at_index (archived_at);
