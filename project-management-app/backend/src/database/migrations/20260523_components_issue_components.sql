-- Migration: Components and Issue Components tables
-- Requirements: 10.1, 10.2

-- Components table for organizing issues by functional area or team responsibility
CREATE TABLE IF NOT EXISTS components (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  default_assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT components_unique_project_name UNIQUE (project_id, name)
);

-- Junction table for many-to-many relationship between issues and components
CREATE TABLE IF NOT EXISTS issue_components (
  id SERIAL PRIMARY KEY,
  issue_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  component_id INTEGER NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT issue_components_unique_component UNIQUE (issue_id, component_id)
);

-- Add RBAC permissions for component management
INSERT INTO role_permissions (role, resource, action, allowed)
VALUES
  ('admin', 'component', '*', TRUE),
  ('manager', 'component', '*', TRUE),
  ('member', 'component', 'read', TRUE),
  ('viewer', 'component', 'read', TRUE)
ON CONFLICT (role, resource, action) DO UPDATE
SET allowed = EXCLUDED.allowed;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_components_project_id ON components(project_id);
CREATE INDEX IF NOT EXISTS idx_components_default_assignee_id ON components(default_assignee_id);
CREATE INDEX IF NOT EXISTS idx_issue_components_issue_id ON issue_components(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_components_component_id ON issue_components(component_id);

-- Add updated_at trigger for components table
DO $$
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS trg_components_updated_at ON components';
  EXECUTE 'CREATE TRIGGER trg_components_updated_at BEFORE UPDATE ON components FOR EACH ROW EXECUTE FUNCTION set_updated_at()';
END;
$$;
