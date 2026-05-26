BEGIN;

-- Issue Watchers Table
-- Allows users to watch issues for notifications
-- Requirements: 13.1, 13.3

CREATE TABLE IF NOT EXISTS issue_watchers (
  id SERIAL PRIMARY KEY,
  issue_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  auto_watched BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT issue_watchers_unique_issue_user UNIQUE (issue_id, user_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_issue_watchers_issue_id ON issue_watchers(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_watchers_user_id ON issue_watchers(user_id);
CREATE INDEX IF NOT EXISTS idx_issue_watchers_added_at ON issue_watchers(added_at);

-- Add permission entries for issue watchers
INSERT INTO role_permissions (role, resource, action, allowed)
VALUES
  ('admin', 'issue_watcher', '*', TRUE),
  ('manager', 'issue_watcher', '*', TRUE),
  ('contributor', 'issue_watcher', 'create', TRUE),
  ('contributor', 'issue_watcher', 'read', TRUE),
  ('contributor', 'issue_watcher', 'delete', TRUE),
  ('member', 'issue_watcher', 'create', TRUE),
  ('member', 'issue_watcher', 'read', TRUE),
  ('member', 'issue_watcher', 'delete', TRUE),
  ('viewer', 'issue_watcher', 'read', TRUE)
ON CONFLICT (role, resource, action)
DO UPDATE SET allowed = EXCLUDED.allowed;

COMMIT;
