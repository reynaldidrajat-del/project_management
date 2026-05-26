-- Migration: Add backlog_order column to tasks table
-- Requirement 4.2: Support drag-and-drop reordering of backlog issues to set priority
-- Requirement 4.3: Update the priority rank field when issue priority is changed
-- Idempotent: uses IF NOT EXISTS

-- Add backlog_order column for ordering issues within the backlog
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS backlog_order INTEGER;

-- Index for efficient backlog ordering queries
CREATE INDEX IF NOT EXISTS idx_tasks_backlog_order ON tasks(project_id, backlog_order)
  WHERE sprint_id IS NULL;

-- Index for efficient backlog filtering
CREATE INDEX IF NOT EXISTS idx_tasks_backlog_project ON tasks(project_id)
  WHERE sprint_id IS NULL;

COMMENT ON COLUMN tasks.backlog_order IS 'Numeric rank for ordering issues in the backlog view (lower = higher priority)';
