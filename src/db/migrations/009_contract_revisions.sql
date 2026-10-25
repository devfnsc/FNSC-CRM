CREATE TABLE IF NOT EXISTS contract_revisions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  contract_id BIGINT UNSIGNED NOT NULL,
  revision_number INT UNSIGNED NOT NULL,
  title VARCHAR(160) NOT NULL,
  effective_date DATE NULL,
  end_date DATE NULL,
  payment_terms VARCHAR(1000) NULL,
  clauses TEXT NULL,
  total DECIMAL(10,2) NOT NULL,
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY contract_revisions_number_unique (contract_id, revision_number),
  KEY contract_revisions_created_by_index (created_by),
  CONSTRAINT contract_revisions_contract_fk FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE,
  CONSTRAINT contract_revisions_user_fk FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO contract_revisions
  (contract_id, revision_number, title, effective_date, end_date, payment_terms, clauses, total, created_by)
SELECT c.id, 1, c.title, c.effective_date, c.end_date, c.payment_terms, c.clauses, c.total, NULL
FROM contracts c
LEFT JOIN contract_revisions r ON r.contract_id = c.id
WHERE r.id IS NULL;
