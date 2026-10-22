CREATE TABLE IF NOT EXISTS customer_activities (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id BIGINT UNSIGNED NOT NULL,
  type ENUM('call', 'email', 'meeting', 'message', 'other') NOT NULL,
  summary VARCHAR(2000) NOT NULL,
  occurred_on DATE NOT NULL,
  follow_up_date DATE NULL,
  follow_up_status ENUM('pending', 'completed') NULL DEFAULT NULL,
  follow_up_completed_at TIMESTAMP NULL DEFAULT NULL,
  created_by BIGINT UNSIGNED NULL,
  follow_up_completed_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY customer_activities_customer_date_index (customer_id, occurred_on, id),
  KEY customer_activities_follow_up_index (follow_up_status, follow_up_date),
  CONSTRAINT customer_activities_customer_fk FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT customer_activities_created_by_fk FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT customer_activities_follow_up_user_fk FOREIGN KEY (follow_up_completed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
