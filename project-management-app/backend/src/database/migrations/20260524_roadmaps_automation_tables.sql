-- Migration: Create roadmaps and automation tables for JIRA parity
-- Requirements: 22.1, 22.6, 25.1
-- This migration creates tables for roadmap planning and workflow automation

-- ============================================================
-- ROADMAPS TABLE
-- ============================================================
-- Stores roadmap definitions for visualizing epics and versions on a timeline

CREATE TABLE IF NOT EXISTS roadmaps (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for roadmaps
CREATE INDEX IF NOT EXISTS idx_roadmaps_project_id ON roadmaps(project_id);
CREATE INDEX IF NOT EXISTS idx_roadmaps_dates ON roadmaps(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_roadmaps_is_default ON roadmaps(is_default);

-- Ensure only one default roadmap per project
CREATE UNIQUE INDEX IF NOT EXISTS idx_roadmaps_unique_default
  ON roadmaps(project_id)
  WHERE is_default = TRUE;

-- Add trigger for automatic updated_at timestamp
DROP TRIGGER IF EXISTS trg_roadmaps_updated_at ON roadmaps;
CREATE TRIGGER trg_roadmaps_updated_at
BEFORE UPDATE ON roadmaps
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Add table comments
COMMENT ON TABLE roadmaps IS 'Stores roadmap definitions for project planning and timeline visualization';
COMMENT ON COLUMN roadmaps.project_id IS 'Project this roadmap belongs to';
COMMENT ON COLUMN roadmaps.name IS 'Roadmap display name';
COMMENT ON COLUMN roadmaps.description IS 'Detailed description of the roadmap purpose';
COMMENT ON COLUMN roadmaps.start_date IS 'Roadmap timeline start date';
COMMENT ON COLUMN roadmaps.end_date IS 'Roadmap timeline end date';
COMMENT ON COLUMN roadmaps.is_default IS 'Whether this is the default roadmap for the project';

-- ============================================================
-- AUTOMATION RULES TABLE
-- ============================================================
-- Stores automation rules with triggers, conditions, and actions

CREATE TABLE IF NOT EXISTS automation_rules (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  trigger JSONB NOT NULL,
  conditions JSONB DEFAULT '[]'::JSONB,
  actions JSONB NOT NULL,
  is_enabled BOOLEAN DEFAULT TRUE,
  execution_count INTEGER DEFAULT 0,
  last_executed_at TIMESTAMP,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for automation_rules
CREATE INDEX IF NOT EXISTS idx_automation_rules_project_id ON automation_rules(project_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_is_enabled ON automation_rules(is_enabled);
CREATE INDEX IF NOT EXISTS idx_automation_rules_created_by ON automation_rules(created_by);

-- Add trigger for automatic updated_at timestamp
DROP TRIGGER IF EXISTS trg_automation_rules_updated_at ON automation_rules;
CREATE TRIGGER trg_automation_rules_updated_at
BEFORE UPDATE ON automation_rules
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- Add table comments
COMMENT ON TABLE automation_rules IS 'Stores automation rules for workflow automation';
COMMENT ON COLUMN automation_rules.project_id IS 'Project this rule belongs to (NULL for global rules)';
COMMENT ON COLUMN automation_rules.name IS 'Human-readable rule name';
COMMENT ON COLUMN automation_rules.description IS 'Detailed description of what the rule does';
COMMENT ON COLUMN automation_rules.trigger IS 'JSONB object defining when the rule fires (e.g., {"type": "issue_created"} or {"type": "scheduled", "cron": "0 9 * * 1"})';
COMMENT ON COLUMN automation_rules.conditions IS 'JSONB array of conditions that must be met (e.g., [{"field": "priority", "operator": "equals", "value": "high"}])';
COMMENT ON COLUMN automation_rules.actions IS 'JSONB array of actions to execute (e.g., [{"type": "assign", "user_id": 1}, {"type": "transition", "status": "In Progress"}])';
COMMENT ON COLUMN automation_rules.is_enabled IS 'Whether the rule is active';
COMMENT ON COLUMN automation_rules.execution_count IS 'Number of times this rule has been executed';
COMMENT ON COLUMN automation_rules.last_executed_at IS 'Timestamp of last execution';
COMMENT ON COLUMN automation_rules.created_by IS 'User who created this rule';

-- ============================================================
-- AUTOMATION LOGS TABLE
-- ============================================================
-- Stores execution history of automation rules

CREATE TABLE IF NOT EXISTS automation_logs (
  id SERIAL PRIMARY KEY,
  rule_id INTEGER NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  issue_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  status VARCHAR(30) NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
  error_message TEXT,
  execution_time_ms INTEGER,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for automation_logs
CREATE INDEX IF NOT EXISTS idx_automation_logs_rule_id ON automation_logs(rule_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_issue_id ON automation_logs(issue_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_status ON automation_logs(status);
CREATE INDEX IF NOT EXISTS idx_automation_logs_executed_at ON automation_logs(executed_at);

-- Add table comments
COMMENT ON TABLE automation_logs IS 'Stores execution history of automation rules for auditing and debugging';
COMMENT ON COLUMN automation_logs.rule_id IS 'The automation rule that was executed';
COMMENT ON COLUMN automation_logs.issue_id IS 'The issue that triggered this execution (if applicable)';
COMMENT ON COLUMN automation_logs.status IS 'Execution result: success, failed, or skipped';
COMMENT ON COLUMN automation_logs.error_message IS 'Error details if status is failed';
COMMENT ON COLUMN automation_logs.execution_time_ms IS 'Time taken to execute the rule in milliseconds';
COMMENT ON COLUMN automation_logs.executed_at IS 'When the rule was executed';

-- ============================================================
-- UPDATE EPICS TABLE FOREIGN KEYS
-- ============================================================
-- Add foreign key constraints from epics to roadmaps and releases

DO $$
BEGIN
  -- Add foreign key from epics.roadmap_id to roadmaps.id
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'epics_roadmap_id_fkey'
  ) THEN
    ALTER TABLE epics
      ADD CONSTRAINT epics_roadmap_id_fkey
      FOREIGN KEY (roadmap_id) REFERENCES roadmaps(id) ON DELETE SET NULL;
  END IF;
  
  -- Add foreign key from epics.release_id to releases.id
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'epics_release_id_fkey'
  ) THEN
    ALTER TABLE epics
      ADD CONSTRAINT epics_release_id_fkey
      FOREIGN KEY (release_id) REFERENCES releases(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Update comments on epics FK columns
COMMENT ON COLUMN epics.roadmap_id IS 'Optional link to roadmap for timeline visualization';
COMMENT ON COLUMN epics.release_id IS 'Optional link to release for version planning';

-- ============================================================
-- ROLE PERMISSIONS FOR AUTOMATION AND ROADMAPS
-- ============================================================
-- Add default permissions for automation and roadmaps

INSERT INTO role_permissions (role, resource, action, allowed)
VALUES
  -- Super Admin gets all permissions
  ('super_admin', 'automation', '*', TRUE),
  ('super_admin', 'roadmap', '*', TRUE),
  
  -- Admin can manage automation and roadmaps
  ('admin', 'automation', 'read', TRUE),
  ('admin', 'automation', 'create', TRUE),
  ('admin', 'automation', 'update', TRUE),
  ('admin', 'automation', 'delete', TRUE),
  ('admin', 'roadmap', 'read', TRUE),
  ('admin', 'roadmap', 'create', TRUE),
  ('admin', 'roadmap', 'update', TRUE),
  ('admin', 'roadmap', 'delete', TRUE),
  
  -- Manager can manage automation and roadmaps in their projects
  ('manager', 'automation', 'read', TRUE),
  ('manager', 'automation', 'create', TRUE),
  ('manager', 'automation', 'update', TRUE),
  ('manager', 'automation', 'delete', TRUE),
  ('manager', 'roadmap', 'read', TRUE),
  ('manager', 'roadmap', 'create', TRUE),
  ('manager', 'roadmap', 'update', TRUE),
  ('manager', 'roadmap', 'delete', TRUE),
  
  -- Contributors can view roadmaps and automation rules
  ('contributor', 'automation', 'read', TRUE),
  ('contributor', 'roadmap', 'read', TRUE),
  
  -- Members can view roadmaps
  ('member', 'roadmap', 'read', TRUE),
  
  -- Viewers can view roadmaps
  ('viewer', 'roadmap', 'read', TRUE)
ON CONFLICT (role, resource, action) DO UPDATE SET allowed = EXCLUDED.allowed;
