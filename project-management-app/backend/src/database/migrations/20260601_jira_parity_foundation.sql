-- Migration: JIRA Parity Foundation
-- Consolidation migration that ensures all JIRA parity tables exist
-- Requirements: 1.1, 2.1, 3.1, 5.1, 7.1, 11.1, 22.1
-- All statements use IF NOT EXISTS for idempotency

-- ============================================================================
-- 1. WORKFLOWS TABLE
-- Requirement 2.1: Allow creation of workflows with custom status sequences
-- ============================================================================

CREATE TABLE IF NOT EXISTS workflows (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workflows_project_id ON workflows(project_id);

-- ============================================================================
-- 2. WORKFLOW STATES TABLE
-- Requirement 2.1: Workflow status nodes
-- ============================================================================

CREATE TABLE IF NOT EXISTS workflow_states (
  id SERIAL PRIMARY KEY,
  workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(30) NOT NULL CHECK (category IN ('TODO', 'IN_PROGRESS', 'DONE')),
  color VARCHAR(30),
  sort_order INTEGER DEFAULT 0,
  is_initial BOOLEAN DEFAULT FALSE,
  is_final BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workflow_states_workflow_id ON workflow_states(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_states_sort_order ON workflow_states(workflow_id, sort_order);

-- ============================================================================
-- 3. WORKFLOW TRANSITIONS TABLE
-- Requirement 2.1: Permitted transitions between states
-- ============================================================================

CREATE TABLE IF NOT EXISTS workflow_transitions (
  id SERIAL PRIMARY KEY,
  workflow_id INTEGER NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  from_state_id INTEGER NOT NULL REFERENCES workflow_states(id) ON DELETE CASCADE,
  to_state_id INTEGER NOT NULL REFERENCES workflow_states(id) ON DELETE CASCADE,
  conditions JSONB DEFAULT '[]'::JSONB,
  validators JSONB DEFAULT '[]'::JSONB,
  post_functions JSONB DEFAULT '[]'::JSONB,
  screen_id INTEGER,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workflow_transitions_workflow_id ON workflow_transitions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_transitions_from_state ON workflow_transitions(from_state_id);
CREATE INDEX IF NOT EXISTS idx_workflow_transitions_to_state ON workflow_transitions(to_state_id);

-- ============================================================================
-- 4. SPRINTS TABLE
-- Requirement 3.1: Allow creation of sprints with name, start date, end date, and goal
-- ============================================================================

CREATE TABLE IF NOT EXISTS sprints (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  goal TEXT,
  start_date DATE,
  end_date DATE,
  state VARCHAR(30) DEFAULT 'FUTURE' CHECK (state IN ('FUTURE', 'ACTIVE', 'CLOSED')),
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sprints_project_id ON sprints(project_id);
CREATE INDEX IF NOT EXISTS idx_sprints_state ON sprints(state);
CREATE INDEX IF NOT EXISTS idx_sprints_project_state ON sprints(project_id, state);

-- ============================================================================
-- 5. ROADMAPS TABLE
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
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_roadmaps_project_id ON roadmaps(project_id);
CREATE INDEX IF NOT EXISTS idx_roadmaps_dates ON roadmaps(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_roadmaps_is_default ON roadmaps(is_default);

-- ============================================================================
-- 6. RELEASES TABLE
-- Requirement 11.1: Allow creation of versions with name, description, release date, and status
-- ============================================================================

CREATE TABLE IF NOT EXISTS releases (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  start_date DATE,
  release_date DATE,
  released BOOLEAN DEFAULT FALSE,
  released_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_releases_project_id ON releases(project_id);
CREATE INDEX IF NOT EXISTS idx_releases_release_date ON releases(release_date);

-- ============================================================================
-- 7. EPICS TABLE
-- Requirement 5.1: Support creation of epic issue types with name, description, and color
-- ============================================================================

CREATE TABLE IF NOT EXISTS epics (
  id SERIAL PRIMARY KEY,
  issue_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  epic_name VARCHAR(200) NOT NULL,
  epic_color VARCHAR(30) DEFAULT 'purple',
  roadmap_id INTEGER REFERENCES roadmaps(id) ON DELETE SET NULL,
  release_id INTEGER REFERENCES releases(id) ON DELETE SET NULL,
  start_date DATE,
  target_end_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_epics_issue_id ON epics(issue_id);
CREATE INDEX IF NOT EXISTS idx_epics_roadmap_id ON epics(roadmap_id);
CREATE INDEX IF NOT EXISTS idx_epics_release_id ON epics(release_id);

-- ============================================================================
-- 8. AUTOMATION RULES TABLE
-- Requirement 22.1: Support creating automation rules with triggers, conditions, and actions
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

CREATE INDEX IF NOT EXISTS idx_automation_rules_project_id ON automation_rules(project_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_is_enabled ON automation_rules(is_enabled);
CREATE INDEX IF NOT EXISTS idx_automation_rules_created_by ON automation_rules(created_by);

-- ============================================================================
-- 9. AUTOMATION LOGS TABLE
-- Requirement 22.6: Log automation rule executions in activity logs
-- ============================================================================

CREATE TABLE IF NOT EXISTS automation_logs (
  id SERIAL PRIMARY KEY,
  rule_id INTEGER NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  issue_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  status VARCHAR(30) NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
  error_message TEXT,
  execution_time_ms INTEGER,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_automation_logs_rule_id ON automation_logs(rule_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_issue_id ON automation_logs(issue_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_status ON automation_logs(status);
CREATE INDEX IF NOT EXISTS idx_automation_logs_executed_at ON automation_logs(executed_at);

-- ============================================================================
-- 10. REPORTS TABLE
-- Requirement 19.6: Allow saving report configurations for reuse
-- ============================================================================

CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  type VARCHAR(50) NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::JSONB,
  is_favorite BOOLEAN DEFAULT FALSE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reports_project_id ON reports(project_id);
CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(type);
CREATE INDEX IF NOT EXISTS idx_reports_created_by ON reports(created_by);
CREATE INDEX IF NOT EXISTS idx_reports_is_favorite ON reports(is_favorite);

-- ============================================================================
-- 11. SAVED FILTERS TABLE
-- Requirement 8.6: Support saved filters that store query definitions
-- ============================================================================

CREATE TABLE IF NOT EXISTS saved_filters (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  jql_query TEXT NOT NULL,
  is_favorite BOOLEAN DEFAULT FALSE,
  is_shared BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_saved_filters_user_id ON saved_filters(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_filters_is_shared ON saved_filters(is_shared);
CREATE INDEX IF NOT EXISTS idx_saved_filters_is_favorite ON saved_filters(is_favorite);

-- ============================================================================
-- 12. TASKS TABLE EXTENSIONS
-- Add JIRA parity columns to existing tasks table
-- Requirements: 1.1, 3.1, 5.1, 6.1
-- ============================================================================

-- Issue type reference
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS issue_type_id INTEGER;

-- Unique issue key (e.g., 'PROJ-123')
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS issue_key VARCHAR(50);

-- Story point estimation
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS story_points INTEGER;

-- Epic reference
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS epic_id INTEGER;

-- Sprint reference
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sprint_id INTEGER;

-- Workflow state reference
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS workflow_state_id INTEGER;

-- Resolution status
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS resolution VARCHAR(100);

-- Environment (for bugs)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS environment TEXT;

-- Version tracking arrays
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS affects_versions TEXT[];
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS fix_versions TEXT[];

-- Component assignment array
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS components TEXT[];

-- ============================================================================
-- 13. FOREIGN KEY CONSTRAINTS FOR TASKS TABLE
-- Added conditionally to avoid errors if constraints already exist
-- ============================================================================

DO $$
BEGIN
  -- FK: tasks.issue_type_id -> issue_types.id
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'issue_types') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'tasks_issue_type_id_fkey' AND table_name = 'tasks'
    ) THEN
      ALTER TABLE tasks
        ADD CONSTRAINT tasks_issue_type_id_fkey
        FOREIGN KEY (issue_type_id) REFERENCES issue_types(id) ON DELETE SET NULL;
    END IF;
  END IF;

  -- FK: tasks.epic_id -> epics.id
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'epics') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'tasks_epic_id_fkey' AND table_name = 'tasks'
    ) THEN
      ALTER TABLE tasks
        ADD CONSTRAINT tasks_epic_id_fkey
        FOREIGN KEY (epic_id) REFERENCES epics(id) ON DELETE SET NULL;
    END IF;
  END IF;

  -- FK: tasks.sprint_id -> sprints.id
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sprints') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'tasks_sprint_id_fkey' AND table_name = 'tasks'
    ) THEN
      ALTER TABLE tasks
        ADD CONSTRAINT tasks_sprint_id_fkey
        FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE SET NULL;
    END IF;
  END IF;

  -- FK: tasks.workflow_state_id -> workflow_states.id
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workflow_states') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE constraint_name = 'tasks_workflow_state_id_fkey' AND table_name = 'tasks'
    ) THEN
      ALTER TABLE tasks
        ADD CONSTRAINT tasks_workflow_state_id_fkey
        FOREIGN KEY (workflow_state_id) REFERENCES workflow_states(id) ON DELETE SET NULL;
    END IF;
  END IF;

  -- Check constraint: story_points must be non-negative
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'tasks_story_points_non_negative' AND table_name = 'tasks'
  ) THEN
    ALTER TABLE tasks
      ADD CONSTRAINT tasks_story_points_non_negative
      CHECK (story_points IS NULL OR story_points >= 0);
  END IF;
END;
$$;

-- ============================================================================
-- 14. INDEXES ON TASKS TABLE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_tasks_issue_type_id ON tasks(issue_type_id);
CREATE INDEX IF NOT EXISTS idx_tasks_workflow_state_id ON tasks(workflow_state_id);
CREATE INDEX IF NOT EXISTS idx_tasks_sprint_id ON tasks(sprint_id);
CREATE INDEX IF NOT EXISTS idx_tasks_epic_id ON tasks(epic_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_issue_key ON tasks(issue_key) WHERE issue_key IS NOT NULL;

-- ============================================================================
-- 15. TRIGGERS FOR AUTOMATIC updated_at TIMESTAMPS
-- ============================================================================

DO $$
BEGIN
  -- Reports trigger
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_reports_updated_at') THEN
    CREATE TRIGGER trg_reports_updated_at
      BEFORE UPDATE ON reports
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();
  END IF;

  -- Saved filters trigger
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_saved_filters_updated_at') THEN
    CREATE TRIGGER trg_saved_filters_updated_at
      BEFORE UPDATE ON saved_filters
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();
  END IF;

  -- Workflows trigger (if not already created)
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_workflows_updated_at') THEN
    CREATE TRIGGER trg_workflows_updated_at
      BEFORE UPDATE ON workflows
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();
  END IF;

  -- Workflow states trigger
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_workflow_states_updated_at') THEN
    CREATE TRIGGER trg_workflow_states_updated_at
      BEFORE UPDATE ON workflow_states
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();
  END IF;

  -- Workflow transitions trigger
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_workflow_transitions_updated_at') THEN
    CREATE TRIGGER trg_workflow_transitions_updated_at
      BEFORE UPDATE ON workflow_transitions
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();
  END IF;

  -- Sprints trigger
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sprints_updated_at') THEN
    CREATE TRIGGER trg_sprints_updated_at
      BEFORE UPDATE ON sprints
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();
  END IF;

  -- Roadmaps trigger
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_roadmaps_updated_at') THEN
    CREATE TRIGGER trg_roadmaps_updated_at
      BEFORE UPDATE ON roadmaps
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();
  END IF;

  -- Epics trigger
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_epics_updated_at') THEN
    CREATE TRIGGER trg_epics_updated_at
      BEFORE UPDATE ON epics
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();
  END IF;

  -- Automation rules trigger
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_automation_rules_updated_at') THEN
    CREATE TRIGGER trg_automation_rules_updated_at
      BEFORE UPDATE ON automation_rules
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();
  END IF;
END;
$$;

-- ============================================================================
-- 16. TABLE AND COLUMN COMMENTS
-- ============================================================================

COMMENT ON TABLE workflows IS 'Workflow definitions that can be project-specific or global';
COMMENT ON TABLE workflow_states IS 'States (statuses) within each workflow';
COMMENT ON TABLE workflow_transitions IS 'Allowed transitions between workflow states with conditions and post-functions';
COMMENT ON TABLE sprints IS 'Time-boxed iterations for Agile sprint management';
COMMENT ON TABLE roadmaps IS 'Strategic planning roadmaps for timeline visualization';
COMMENT ON TABLE releases IS 'Version/release milestones for tracking issue completion';
COMMENT ON TABLE epics IS 'Epic-specific metadata linked to task records';
COMMENT ON TABLE automation_rules IS 'Rule-based automation with triggers, conditions, and actions';
COMMENT ON TABLE automation_logs IS 'Execution history and audit trail for automation rules';
COMMENT ON TABLE reports IS 'Saved report configurations for analytics and metrics';
COMMENT ON TABLE saved_filters IS 'User-saved JQL query filters for advanced issue searching';

COMMENT ON COLUMN tasks.issue_type_id IS 'References issue_types.id - type classification (Epic, Story, Task, Bug, Subtask)';
COMMENT ON COLUMN tasks.issue_key IS 'Unique issue identifier in format {PROJECT_KEY}-{NUMBER} (e.g., PROJ-123)';
COMMENT ON COLUMN tasks.story_points IS 'Estimation value using Fibonacci sequence (1, 2, 3, 5, 8, 13, 21)';
COMMENT ON COLUMN tasks.epic_id IS 'References epics.id - parent epic for Stories, Tasks, and Bugs';
COMMENT ON COLUMN tasks.sprint_id IS 'References sprints.id - sprint assignment for Agile workflow';
COMMENT ON COLUMN tasks.workflow_state_id IS 'References workflow_states.id - current state in workflow';
COMMENT ON COLUMN tasks.resolution IS 'Resolution status when issue is completed (e.g., Fixed, Wont Fix, Duplicate)';
COMMENT ON COLUMN tasks.environment IS 'Environment where bug was observed (e.g., Production, Staging, Development)';
COMMENT ON COLUMN tasks.affects_versions IS 'Array of version names where this issue is known to occur';
COMMENT ON COLUMN tasks.fix_versions IS 'Array of version names where this issue is planned to be fixed';
COMMENT ON COLUMN tasks.components IS 'Array of component names this issue is associated with';
