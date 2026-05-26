-- Migration: Issue Key Sequences
-- Task: 5.1 - Create issue key service
-- Adds project_key column to projects table and creates project_key_sequences table
-- for atomic, concurrent-safe issue key generation.

-- Add project_key column to projects table
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS project_key VARCHAR(10);

-- Create unique index on project_key (partial: only non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_project_key
  ON projects(project_key) WHERE project_key IS NOT NULL;

-- Create project_key_sequences table for atomic sequence generation per project
CREATE TABLE IF NOT EXISTS project_key_sequences (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  current_sequence INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT project_key_sequences_unique_project UNIQUE (project_id)
);

-- Add comment for documentation
COMMENT ON TABLE project_key_sequences IS 'Tracks the current issue key sequence number per project for atomic key generation';
COMMENT ON COLUMN project_key_sequences.current_sequence IS 'The last used sequence number for this project';
COMMENT ON COLUMN projects.project_key IS 'Short uppercase key used for issue identifiers (e.g., PROJ, BUG, DEV)';
