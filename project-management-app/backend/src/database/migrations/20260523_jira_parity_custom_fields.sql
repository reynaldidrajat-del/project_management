-- Migration: Custom Fields tables for Jira parity
-- Requirements: 7.1, 7.2, 7.3
-- Task: 1.6 - Create custom_fields and custom_field_values tables

-- ============================================================================
-- Custom Fields Table
-- Stores user-defined fields that can be added to issue types
-- ============================================================================

CREATE TABLE IF NOT EXISTS custom_fields (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  field_type VARCHAR(50) NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'select', 'multi_select', 'user', 'checkbox', 'url')),
  options JSONB DEFAULT '[]'::JSONB,
  is_required BOOLEAN DEFAULT FALSE,
  default_value TEXT,
  applicable_issue_types TEXT[],
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Custom Field Values Table
-- Stores the actual values for custom fields on issues
-- ============================================================================

CREATE TABLE IF NOT EXISTS custom_field_values (
  id SERIAL PRIMARY KEY,
  issue_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  custom_field_id INTEGER NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
  value TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT custom_field_values_unique UNIQUE (issue_id, custom_field_id)
);

-- ============================================================================
-- Add RBAC permissions for custom field management
-- ============================================================================

INSERT INTO role_permissions (role, resource, action, allowed)
VALUES
  ('admin', 'custom_field', '*', TRUE),
  ('manager', 'custom_field', '*', TRUE),
  ('member', 'custom_field', 'read', TRUE),
  ('viewer', 'custom_field', 'read', TRUE)
ON CONFLICT (role, resource, action) DO UPDATE
SET allowed = EXCLUDED.allowed;

-- ============================================================================
-- Create indexes for performance
-- ============================================================================

-- Index for project_id lookups on custom_fields
CREATE INDEX IF NOT EXISTS idx_custom_fields_project_id ON custom_fields(project_id);

-- Index for field_type filtering
CREATE INDEX IF NOT EXISTS idx_custom_fields_field_type ON custom_fields(field_type);

-- Index for sort_order on custom_fields
CREATE INDEX IF NOT EXISTS idx_custom_fields_sort_order ON custom_fields(sort_order);

-- Index for issue_id lookups on custom_field_values
CREATE INDEX IF NOT EXISTS idx_custom_field_values_issue_id ON custom_field_values(issue_id);

-- Index for custom_field_id lookups on custom_field_values
CREATE INDEX IF NOT EXISTS idx_custom_field_values_custom_field_id ON custom_field_values(custom_field_id);

-- ============================================================================
-- Add updated_at triggers for automatic timestamp updates
-- ============================================================================

DO $$
BEGIN
  -- Trigger for custom_fields table
  EXECUTE 'DROP TRIGGER IF EXISTS trg_custom_fields_updated_at ON custom_fields';
  EXECUTE 'CREATE TRIGGER trg_custom_fields_updated_at BEFORE UPDATE ON custom_fields FOR EACH ROW EXECUTE FUNCTION set_updated_at()';
  
  -- Trigger for custom_field_values table
  EXECUTE 'DROP TRIGGER IF EXISTS trg_custom_field_values_updated_at ON custom_field_values';
  EXECUTE 'CREATE TRIGGER trg_custom_field_values_updated_at BEFORE UPDATE ON custom_field_values FOR EACH ROW EXECUTE FUNCTION set_updated_at()';
END;
$$;

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE custom_fields IS 'User-defined custom fields for issues, supporting multiple field types';
COMMENT ON TABLE custom_field_values IS 'Actual values stored for custom fields on issues';

COMMENT ON COLUMN custom_fields.project_id IS 'Project this custom field belongs to. NULL for global custom fields';
COMMENT ON COLUMN custom_fields.name IS 'Display name of the custom field';
COMMENT ON COLUMN custom_fields.description IS 'Optional description/help text for the custom field';
COMMENT ON COLUMN custom_fields.field_type IS 'Type of field: text, number, date, select, multi_select, user, checkbox, url';
COMMENT ON COLUMN custom_fields.options IS 'JSONB array of options for select/multi_select fields, e.g., [{"value": "Option1", "sort_order": 1}]';
COMMENT ON COLUMN custom_fields.is_required IS 'Whether this field must be filled when creating/editing an issue';
COMMENT ON COLUMN custom_fields.default_value IS 'Default value for the field when creating new issues';
COMMENT ON COLUMN custom_fields.applicable_issue_types IS 'Array of issue type names this field applies to. NULL or empty means applies to all types';
COMMENT ON COLUMN custom_fields.sort_order IS 'Display order of the field in forms';

COMMENT ON COLUMN custom_field_values.issue_id IS 'Reference to the issue (task) this value belongs to';
COMMENT ON COLUMN custom_field_values.custom_field_id IS 'Reference to the custom field definition';
COMMENT ON COLUMN custom_field_values.value IS 'The stored value. For user type, stores user_id. For multi_select, stores JSON array of selected values';
