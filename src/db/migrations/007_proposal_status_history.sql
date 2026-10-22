CREATE TABLE IF NOT EXISTS proposal_status_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  proposal_id BIGINT UNSIGNED NOT NULL,
  previous_status ENUM('draft', 'sent', 'accepted', 'rejected') NULL,
  new_status ENUM('draft', 'sent', 'accepted', 'rejected') NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY proposal_status_history_proposal_index (proposal_id, created_at),
  CONSTRAINT proposal_status_history_proposal_fk FOREIGN KEY (proposal_id) REFERENCES proposals(id) ON DELETE CASCADE,
  CONSTRAINT proposal_status_history_user_fk FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO proposal_status_history (proposal_id, previous_status, new_status, user_id, created_at)
SELECT p.id, NULL, p.status, NULL, p.created_at
FROM proposals p
LEFT JOIN proposal_status_history h ON h.proposal_id = p.id
WHERE h.id IS NULL;
