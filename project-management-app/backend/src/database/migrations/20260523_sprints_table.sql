-- Migration: Create sprints table for Jira parity sprint management
-- Requirements: 3.1, 3.2

CREATE TABLE IF NOT EXISTS sprints (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  goal TEXT,
  start_date DATE,
  end_date DATE,
  state VARCHAR(20) NOT NULL DEFAULT 'FUTURE',
  completed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT sprints_state_allowed CHECK (state IN ('FUTURE', 'ACTIVE', 'CLOSED')),
  CONSTRAINT sprints_dates_order CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_sprints_project_id ON sprints(project_id);
CREATE INDEX IF NOT EXISTS idx_sprints_state ON sprints(state);
CREATE INDEX IF NOT EXISTS idx_sprints_project_state ON sprints(project_id, state);

-- Add updated_at trigger for sprints table
DROP TRIGGER IF EXISTS trg_sprints_updated_at ON sprints;
CREATE TRIGGER trg_sprints_updated_at
  BEFORE UPDATE ON sprints
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();
