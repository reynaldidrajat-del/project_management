-- Migration: Roadmaps and Automation Tables
-- Requirements: 22.1, 22.6, 25.1
-- Task: 1.12 - Create migration for roadmaps and automation tables

-- ============================================================================
-- Roadmaps Table
-- Stores roadmap definitions for strategic planning and timeline visualization
-- Requirement 25.1: Display roadmap view showing epics and versions on a timeline
-- ============================================================================

CREATE TABLE IF NOT EXISTS roadmaps (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT roadmaps_dates_order CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date)
);

-- ============================================================================
-- Automation Rules Table
-- Stores automation rules with triggers, conditions, and actions
-- Requirement 22.1: Support creating automation rules with triggers, conditions, and actions
-- Requirement 22.6: Log automation rule executions in activity logs
-- ============================================================================

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

-- ============================================================================
-- Automation Logs Table
-- Stores execution history for automation rules
-- Requirement 22.6: Log automation rule executions in activity logs
-- ============================================================================

CREATE TABLE IF NOT EXISTS automation_logs (
  id SERIAL PRIMARY KEY,
  rule_id INTEGER NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  issue_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  status VARCHAR(30) CHECK (status IN ('success', 'failed', 'skipped')),
  error_message TEXT,
  execution_time_ms INTEGER,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Create indexes for performance
-- ============================================================================

-- Indexes for roadmaps
CREATE INDEX IF NOT EXISTS idx_roadmaps_project_id ON roadmaps(project_id);
CREATE INDEX IF NOT EXISTS idx_roadmaps_is_default ON roadmaps(is_default);
CREATE INDEX IF NOT EXISTS idx_roadmaps_dates ON roadmaps(start_date, end_date);

-- Indexes for automation_rules
CREATE INDEX IF NOT EXISTS idx_automation_rules_project_id ON automation_rules(project_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_is_enabled ON automation_rules(is_enabled);
CREATE INDEX IF NOT EXISTS idx_automation_rules_created_by ON automation_rules(created_by);

-- Indexes for automation_logs
CREATE INDEX IF NOT EXISTS idx_automation_logs_rule_id ON automation_logs(rule_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_issue_id ON automation_logs(issue_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_status ON automation_logs(status);
CREATE INDEX IF NOT EXISTS idx_automation_logs_executed_at ON automation_logs(executed_at);

-- ============================================================================
-- Add updated_at triggers for automatic timestamp updates
-- ============================================================================

DO $$
BEGIN
  -- Trigger for roadmaps table
  EXECUTE 'DROP TRIGGER IF EXISTS trg_roadmaps_updated_at ON roadmaps';
  EXECUTE 'CREATE TRIGGER trg_roadmaps_updated_at BEFORE UPDATE ON roadmaps FOR EACH ROW EXECUTE FUNCTION set_updated_at()';
  
  -- Trigger for automation_rules table
  EXECUTE 'DROP TRIGGER IF EXISTS trg_automation_rules_updated_at ON automation_rules';
  EXECUTE 'CREATE TRIGGER trg_automation_rules_updated_at BEFORE UPDATE ON automation_rules FOR EACH ROW EXECUTE FUNCTION set_updated_at()';
END;
$$;

-- ============================================================================
-- Add RBAC permissions for roadmap and automation management
-- ============================================================================

-- Roadmap permissions
INSERT INTO role_permissions (role, resource, action, allowed)
VALUES
  ('admin', 'roadmap', '*', TRUE),
  ('manager', 'roadmap', '*', TRUE),
  ('member', 'roadmap', 'read', TRUE),
  ('viewer', 'roadmap', 'read', TRUE)
ON CONFLICT (role, resource, action) DO UPDATE
SET allowed = EXCLUDED.allowed;

-- Automation rule permissions
INSERT INTO role_permissions (role, resource, action, allowed)
VALUES
  ('admin', 'automation_rule', '*', TRUE),
  ('manager', 'automation_rule', '*', TRUE),
  ('member', 'automation_rule', 'read', TRUE),
  ('viewer', 'automation_rule', 'read', TRUE)
ON CONFLICT (role, resource, action) DO UPDATE
SET allowed = EXCLUDED.allowed;

-- Automation log permissions (read-only for most roles)
INSERT INTO role_permissions (role, resource, action, allowed)
VALUES
  ('admin', 'automation_log', '*', TRUE),
  ('manager', 'automation_log', 'read', TRUE),
  ('member', 'automation_log', 'read', TRUE),
  ('viewer', 'automation_log', 'read', TRUE)
ON CONFLICT (role, resource, action) DO UPDATE
SET allowed = EXCLUDED.allowed;

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE roadmaps IS 'Strategic planning roadmaps for visualizing epic and version timelines';
COMMENT ON TABLE automation_rules IS 'Rule-based automation for workflows with triggers, conditions, and actions';
COMMENT ON TABLE automation_logs IS 'Execution history and audit trail for automation rules';

COMMENT ON COLUMN roadmaps.project_id IS 'Project this roadmap belongs to';
COMMENT ON COLUMN roadmaps.name IS 'Display name of the roadmap';
COMMENT ON COLUMN roadmaps.description IS 'Optional description of the roadmap purpose';
COMMENT ON COLUMN roadmaps.start_date IS 'Start date of the roadmap timeline';
COMMENT ON COLUMN roadmaps.end_date IS 'End date of the roadmap timeline';
COMMENT ON COLUMN roadmaps.is_default IS 'Whether this is the default roadmap for the project';

COMMENT ON COLUMN automation_rules.project_id IS 'Project this rule belongs to. NULL for global rules';
COMMENT ON COLUMN automation_rules.name IS 'Display name of the automation rule';
COMMENT ON COLUMN automation_rules.description IS 'Optional description of what the rule does';
COMMENT ON COLUMN automation_rules.trigger IS 'JSONB object defining the trigger: {"type": "issue_created|issue_updated|issue_transitioned|comment_added|scheduled", "config": {...}}';
COMMENT ON COLUMN automation_rules.conditions IS 'JSONB array of conditions that must be met: [{"type": "field_value|user_role|issue_type|custom_jql", "operator": "equals|not_equals|contains|greater_than|less_than", "value": ...}]';
COMMENT ON COLUMN automation_rules.actions IS 'JSONB array of actions to execute: [{"type": "update_field|transition_issue|send_notification|create_issue|add_comment|assign_user", "config": {...}}]';
COMMENT ON COLUMN automation_rules.is_enabled IS 'Whether the rule is currently active';
COMMENT ON COLUMN automation_rules.execution_count IS 'Total number of times this rule has been executed';
COMMENT ON COLUMN automation_rules.last_executed_at IS 'Timestamp of the most recent execution';
COMMENT ON COLUMN automation_rules.created_by IS 'User who created this automation rule';

COMMENT ON COLUMN automation_logs.rule_id IS 'Reference to the automation rule that was executed';
COMMENT ON COLUMN automation_logs.issue_id IS 'Issue that triggered this execution, if applicable';
COMMENT ON COLUMN automation_logs.status IS 'Execution result: success, failed, or skipped';
COMMENT ON COLUMN automation_logs.error_message IS 'Error details if status is failed';
COMMENT ON COLUMN automation_logs.execution_time_ms IS 'Duration of rule execution in milliseconds';
COMMENT ON COLUMN automation_logs.executed_at IS 'Timestamp when the rule was executed';
