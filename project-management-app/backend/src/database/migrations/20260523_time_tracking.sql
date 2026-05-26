-- Migration: Time Tracking Tables
-- Requirements: 12.1, 12.2
-- Description: Adds time_logs table and estimate columns to tasks for time tracking functionality

-- Add time estimate columns to tasks table
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS original_estimate_minutes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS remaining_estimate_minutes INTEGER DEFAULT 0;

-- Add constraint to ensure non-negative estimates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_original_estimate_non_negative'
  ) THEN
    ALTER TABLE tasks ADD CONSTRAINT tasks_original_estimate_non_negative CHECK (original_estimate_minutes >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_remaining_estimate_non_negative'
  ) THEN
    ALTER TABLE tasks ADD CONSTRAINT tasks_remaining_estimate_non_negative CHECK (remaining_estimate_minutes >= 0);
  END IF;
END;
$$;

-- Create time_logs table for tracking work entries
CREATE TABLE IF NOT EXISTS time_logs (
  id SERIAL PRIMARY KEY,
  issue_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  time_spent_minutes INTEGER NOT NULL DEFAULT 0,
  work_date DATE NOT NULL,
  description TEXT,
  remaining_estimate_minutes INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT time_logs_time_spent_non_negative CHECK (time_spent_minutes >= 0),
  CONSTRAINT time_logs_remaining_estimate_non_negative CHECK (remaining_estimate_minutes >= 0)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_time_logs_issue_id ON time_logs(issue_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_user_id ON time_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_work_date ON time_logs(work_date);
CREATE INDEX IF NOT EXISTS idx_time_logs_created_at ON time_logs(created_at);

-- Add updated_at trigger for time_logs table
DROP TRIGGER IF EXISTS trg_time_logs_updated_at ON time_logs;
CREATE TRIGGER trg_time_logs_updated_at
  BEFORE UPDATE ON time_logs
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- Add permissions for time tracking
INSERT INTO role_permissions (role, resource, action, allowed)
VALUES
  ('admin', 'time_log', '*', TRUE),
  ('manager', 'time_log', '*', TRUE),
  ('contributor', 'time_log', 'create', TRUE),
  ('contributor', 'time_log', 'read', TRUE),
  ('contributor', 'time_log', 'update', TRUE),
  ('contributor', 'time_log', 'delete', TRUE),
  ('member', 'time_log', 'create', TRUE),
  ('member', 'time_log', 'read', TRUE),
  ('member', 'time_log', 'update', TRUE),
  ('member', 'time_log', 'delete', TRUE),
  ('viewer', 'time_log', 'read', TRUE)
ON CONFLICT (role, resource, action) DO UPDATE
SET allowed = EXCLUDED.allowed;

-- Add indexes for estimate columns on tasks
CREATE INDEX IF NOT EXISTS idx_tasks_original_estimate ON tasks(original_estimate_minutes);
CREATE INDEX IF NOT EXISTS idx_tasks_remaining_estimate ON tasks(remaining_estimate_minutes);
