-- Migration: Create epics table for JIRA parity
-- Requirements: 5.1, 5.2
-- This table stores epic-specific metadata linked to issues (tasks)

-- Create epics table
-- Note: roadmap_id and release_id foreign keys will be added when those tables are created (task 1.12)
CREATE TABLE IF NOT EXISTS epics (
  id SERIAL PRIMARY KEY,
  issue_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  epic_name VARCHAR(200) NOT NULL,
  epic_color VARCHAR(30) DEFAULT 'purple',
  roadmap_id INTEGER NULL, -- Will reference roadmaps(id) when created
  release_id INTEGER NULL, -- Will reference releases(id) when created
  start_date DATE NULL,
  target_end_date DATE NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT epics_issue_unique UNIQUE (issue_id)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_epics_issue_id ON epics(issue_id);
CREATE INDEX IF NOT EXISTS idx_epics_roadmap_id ON epics(roadmap_id);
CREATE INDEX IF NOT EXISTS idx_epics_release_id ON epics(release_id);
CREATE INDEX IF NOT EXISTS idx_epics_dates ON epics(start_date, target_end_date);

-- Add trigger for automatic updated_at timestamp
DROP TRIGGER IF EXISTS trg_epics_updated_at ON epics;
CREATE TRIGGER trg_epics_updated_at
BEFORE UPDATE ON epics
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Add epic_id column to tasks table for linking issues to epics
-- This allows any issue (Story, Task, Bug) to be linked to a parent Epic
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'epic_id'
  ) THEN
    ALTER TABLE tasks ADD COLUMN epic_id INTEGER REFERENCES epics(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for tasks.epic_id for efficient filtering
CREATE INDEX IF NOT EXISTS idx_tasks_epic_id ON tasks(epic_id);

-- Add comment to document the table purpose
COMMENT ON TABLE epics IS 'Stores epic-specific metadata. Each epic is linked to a task record via issue_id.';
COMMENT ON COLUMN epics.issue_id IS 'References the tasks table - the epic issue record';
COMMENT ON COLUMN epics.epic_name IS 'Display name for the epic';
COMMENT ON COLUMN epics.epic_color IS 'Color code for epic visualization (e.g., purple, blue, green)';
COMMENT ON COLUMN epics.roadmap_id IS 'Optional link to roadmap (will be FK when roadmaps table created)';
COMMENT ON COLUMN epics.release_id IS 'Optional link to release (will be FK when releases table created)';
COMMENT ON COLUMN epics.start_date IS 'Planned start date for the epic';
COMMENT ON COLUMN epics.target_end_date IS 'Target completion date for the epic';
