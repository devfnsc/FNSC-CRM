CREATE TABLE IF NOT EXISTS contract_status_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  contract_id BIGINT UNSIGNED NOT NULL,
  status ENUM('draft', 'signed', 'cancelled') NOT NULL,
  changed_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY contract_status_history_contract_index (contract_id, id),
  KEY contract_status_history_user_index (changed_by),
  CONSTRAINT contract_status_history_contract_fk FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE,
  CONSTRAINT contract_status_history_user_fk FOREIGN KEY (changed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO contract_status_history (contract_id, status, changed_by)
SELECT c.id, c.status, NULL
FROM contracts c
LEFT JOIN contract_status_history h ON h.contract_id = c.id
WHERE h.id IS NULL;
