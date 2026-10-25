CREATE TABLE IF NOT EXISTS contracts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  proposal_id BIGINT UNSIGNED NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  customer_name VARCHAR(120) NOT NULL,
  customer_company VARCHAR(120) NULL,
  customer_email VARCHAR(254) NULL,
  title VARCHAR(160) NOT NULL,
  status ENUM('draft', 'signed', 'cancelled') NOT NULL DEFAULT 'draft',
  effective_date DATE NULL,
  end_date DATE NULL,
  payment_terms VARCHAR(1000) NULL,
  clauses TEXT NULL,
  total DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY contracts_proposal_unique (proposal_id),
  KEY contracts_customer_index (customer_id),
  KEY contracts_status_index (status),
  CONSTRAINT contracts_proposal_fk FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE RESTRICT,
  CONSTRAINT contracts_customer_fk FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS contract_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  contract_id BIGINT UNSIGNED NOT NULL,
  service_name VARCHAR(120) NOT NULL,
  description VARCHAR(2000) NULL,
  quantity SMALLINT UNSIGNED NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  line_total DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY contract_items_contract_index (contract_id),
  CONSTRAINT contract_items_contract_fk FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
