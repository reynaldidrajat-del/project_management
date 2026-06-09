-- Migration: Phase 6 performance and security hardening
-- Requirements: 8.2, 19.1, 22.1, 22.6

-- Composite issue indexes used by boards, backlog, sprint views, and JQL filters.
CREATE INDEX IF NOT EXISTS idx_tasks_project_type_status
  ON tasks(project_id, issue_type_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_project_workflow_sprint
  ON tasks(project_id, workflow_state_id, sprint_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_project_updated
  ON tasks(project_id, updated_at DESC, id DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_assignee_project
  ON tasks(assignee_id, project_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_task_assignees_user_task
  ON task_assignees(user_id, task_id);

CREATE INDEX IF NOT EXISTS idx_custom_field_values_field_lower_value
  ON custom_field_values(custom_field_id, lower(value));

-- Full-text index for JQL text searches across title and description.
CREATE INDEX IF NOT EXISTS idx_tasks_title_description_fts
  ON tasks
  USING GIN (to_tsvector('simple', COALESCE(title, '') || ' ' || COALESCE(description, '')))
  WHERE deleted_at IS NULL;

-- Permissions for dedicated Jira-parity bulk/import/export APIs and workflow execution.
INSERT INTO role_permissions (role, resource, action, allowed)
VALUES
  ('admin', 'bulk_operation', '*', TRUE),
  ('admin', 'import_export', '*', TRUE),
  ('admin', 'workflow', 'execute', TRUE),
  ('manager', 'bulk_operation', '*', TRUE),
  ('manager', 'import_export', '*', TRUE),
  ('manager', 'workflow', 'execute', TRUE),
  ('contributor', 'bulk_operation', 'execute', TRUE),
  ('contributor', 'custom_field', 'read', TRUE),
  ('contributor', 'import_export', 'export', TRUE),
  ('contributor', 'import_export', 'import', TRUE),
  ('contributor', 'workflow', 'execute', TRUE),
  ('member', 'bulk_operation', 'execute', TRUE),
  ('member', 'custom_field', 'read', TRUE),
  ('member', 'import_export', 'export', TRUE),
  ('member', 'import_export', 'import', TRUE),
  ('member', 'workflow', 'execute', TRUE),
  ('viewer', 'custom_field', 'read', TRUE),
  ('viewer', 'import_export', 'export', TRUE)
ON CONFLICT (role, resource, action) DO UPDATE
SET allowed = EXCLUDED.allowed;
