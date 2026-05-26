-- Migration: Issue Types Table
-- Creates the issue_types table for JIRA-style issue type management
-- Requirements: 1.1, 1.2, 1.6

-- Create issue_types table
CREATE TABLE IF NOT EXISTS issue_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(50),
  color VARCHAR(30),
  hierarchy_level INTEGER NOT NULL DEFAULT 0,
  allowed_parent_types TEXT[],
  allowed_child_types TEXT[],
  default_workflow_id INTEGER, -- Will reference workflows(id) after workflows table is created
  is_system BOOLEAN DEFAULT FALSE,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_issue_types_project_id ON issue_types(project_id);
CREATE INDEX IF NOT EXISTS idx_issue_types_is_system ON issue_types(is_system);
CREATE INDEX IF NOT EXISTS idx_issue_types_name ON issue_types(name);

-- Create trigger for automatic updated_at
DROP TRIGGER IF EXISTS set_issue_types_updated_at ON issue_types;
CREATE TRIGGER set_issue_types_updated_at
  BEFORE UPDATE ON issue_types
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Insert predefined system issue types
-- Hierarchy levels: 0=Epic, 1=Story, 2=Task/Bug, 3=Subtask
INSERT INTO issue_types (name, icon, color, hierarchy_level, allowed_parent_types, allowed_child_types, is_system, project_id)
VALUES
  -- Epic (level 0) - Top level, can contain Stories, Tasks, Bugs
  (
    'Epic',
    'Layers',
    '#6554C0',
    0,
    ARRAY[]::TEXT[], -- Epics have no parent
    ARRAY['Story', 'Task', 'Bug', 'Subtask']::TEXT[],
    TRUE,
    NULL
  ),
  -- Story (level 1) - Can belong to Epic, can contain Tasks, Bugs, Subtasks
  (
    'Story',
    'Bookmark',
    '#63B3ED',
    1,
    ARRAY['Epic']::TEXT[],
    ARRAY['Task', 'Bug', 'Subtask']::TEXT[],
    TRUE,
    NULL
  ),
  -- Task (level 2) - Can belong to Epic or Story, can contain Subtasks
  (
    'Task',
    'CheckSquare',
    '#4ADE80',
    2,
    ARRAY['Epic', 'Story']::TEXT[],
    ARRAY['Subtask']::TEXT[],
    TRUE,
    NULL
  ),
  -- Bug (level 2) - Can belong to Epic or Story, can contain Subtasks
  (
    'Bug',
    'Bug',
    '#F87171',
    2,
    ARRAY['Epic', 'Story']::TEXT[],
    ARRAY['Subtask']::TEXT[],
    TRUE,
    NULL
  ),
  -- Subtask (level 3) - Must belong to Task, Bug, or Story
  (
    'Subtask',
    'List',
    '#A3A3A3',
    3,
    ARRAY['Story', 'Task', 'Bug']::TEXT[],
    ARRAY[]::TEXT[], -- Subtasks cannot have children
    TRUE,
    NULL
  )
ON CONFLICT DO NOTHING;

-- Add unique constraint for name within project scope (system types have NULL project_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_issue_types_unique_name_per_project 
  ON issue_types (name, COALESCE(project_id, -1));

-- Comment on table for documentation
COMMENT ON TABLE issue_types IS 'Defines issue types for JIRA-style work item classification. System types are global (project_id IS NULL), custom types are project-specific.';
COMMENT ON COLUMN issue_types.hierarchy_level IS '0=Epic (top), 1=Story, 2=Task/Bug, 3=Subtask (bottom)';
COMMENT ON COLUMN issue_types.allowed_parent_types IS 'Array of issue type names that can be parent of this type';
COMMENT ON COLUMN issue_types.allowed_child_types IS 'Array of issue type names that can be children of this type';
COMMENT ON COLUMN issue_types.is_system IS 'TRUE for predefined system types, FALSE for custom project types';
COMMENT ON COLUMN issue_types.default_workflow_id IS 'Reference to default workflow for this issue type (set after workflows table is created)';
