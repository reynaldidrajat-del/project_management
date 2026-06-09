-- Migration: Issue Links Table
-- Creates table for linking issues with relationships like blocks, relates to, duplicates
-- Requirements: 9.1, 9.2, 9.5

CREATE TABLE IF NOT EXISTS issue_links (
  id SERIAL PRIMARY KEY,
  source_issue_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  target_issue_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  link_type VARCHAR(30) NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT issue_links_type_allowed CHECK (link_type IN ('blocks', 'is_blocked_by', 'relates_to', 'duplicates', 'is_duplicated_by')),
  CONSTRAINT issue_links_not_self_referential CHECK (source_issue_id <> target_issue_id)
);

ALTER TABLE issue_links
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Unique constraint to prevent duplicate links between the same two issues with the same type
CREATE UNIQUE INDEX IF NOT EXISTS idx_issue_links_unique ON issue_links(source_issue_id, target_issue_id, link_type);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_issue_links_source ON issue_links(source_issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_links_target ON issue_links(target_issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_links_type ON issue_links(link_type);
CREATE INDEX IF NOT EXISTS idx_issue_links_created_by ON issue_links(created_by);

-- Trigger for automatic updated_at (using existing set_updated_at function)
DROP TRIGGER IF EXISTS trg_issue_links_updated_at ON issue_links;
CREATE TRIGGER trg_issue_links_updated_at
BEFORE UPDATE ON issue_links
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Add role permissions for issue links
INSERT INTO role_permissions (role, resource, action, allowed)
VALUES
  ('super_admin', 'issue_links', '*', TRUE),
  ('admin', 'issue_links', '*', TRUE),
  ('manager', 'issue_links', 'read', TRUE),
  ('manager', 'issue_links', 'create', TRUE),
  ('manager', 'issue_links', 'delete', TRUE),
  ('contributor', 'issue_links', 'read', TRUE),
  ('contributor', 'issue_links', 'create', TRUE),
  ('contributor', 'issue_links', 'delete', TRUE),
  ('member', 'issue_links', 'read', TRUE),
  ('member', 'issue_links', 'create', TRUE),
  ('member', 'issue_links', 'delete', TRUE),
  ('viewer', 'issue_links', 'read', TRUE)
ON CONFLICT (role, resource, action) DO UPDATE SET allowed = EXCLUDED.allowed;
