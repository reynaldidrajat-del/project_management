-- Phase 4: Reporting, analytics, templates, and priority schemes.

CREATE TABLE IF NOT EXISTS velocity_history (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sprint_id INTEGER NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
  committed_story_points INTEGER DEFAULT 0,
  completed_story_points INTEGER DEFAULT 0,
  committed_issue_count INTEGER DEFAULT 0,
  completed_issue_count INTEGER DEFAULT 0,
  scope_change_story_points INTEGER DEFAULT 0,
  sprint_started_at DATE,
  sprint_completed_at TIMESTAMP,
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT velocity_history_unique_sprint UNIQUE (sprint_id),
  CONSTRAINT velocity_history_non_negative CHECK (
    committed_story_points >= 0
    AND completed_story_points >= 0
    AND committed_issue_count >= 0
    AND completed_issue_count >= 0
  )
);

CREATE TABLE IF NOT EXISTS issue_templates (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  issue_type_id INTEGER REFERENCES issue_types(id) ON DELETE SET NULL,
  fields JSONB NOT NULL DEFAULT '{}'::JSONB,
  subtasks JSONB NOT NULL DEFAULT '[]'::JSONB,
  checklists JSONB NOT NULL DEFAULT '[]'::JSONB,
  is_shared BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS priority_schemes (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  priorities JSONB NOT NULL DEFAULT '[]'::JSONB,
  default_priority VARCHAR(50) NOT NULL DEFAULT 'Medium',
  is_default BOOLEAN DEFAULT FALSE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS project_priority_schemes (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  scheme_id INTEGER NOT NULL REFERENCES priority_schemes(id) ON DELETE CASCADE,
  assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT project_priority_schemes_unique_project UNIQUE (project_id)
);

CREATE TABLE IF NOT EXISTS dashboard_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  layout JSONB NOT NULL DEFAULT '[]'::JSONB,
  widgets JSONB NOT NULL DEFAULT '[]'::JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT dashboard_preferences_unique_scope UNIQUE (user_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_velocity_history_project_id ON velocity_history(project_id);
CREATE INDEX IF NOT EXISTS idx_velocity_history_sprint_id ON velocity_history(sprint_id);
CREATE INDEX IF NOT EXISTS idx_velocity_history_completed_at ON velocity_history(sprint_completed_at);

CREATE INDEX IF NOT EXISTS idx_issue_templates_project_id ON issue_templates(project_id);
CREATE INDEX IF NOT EXISTS idx_issue_templates_issue_type_id ON issue_templates(issue_type_id);
CREATE INDEX IF NOT EXISTS idx_issue_templates_is_shared ON issue_templates(is_shared);
CREATE INDEX IF NOT EXISTS idx_issue_templates_is_active ON issue_templates(is_active);

CREATE INDEX IF NOT EXISTS idx_priority_schemes_is_default ON priority_schemes(is_default);
CREATE INDEX IF NOT EXISTS idx_project_priority_schemes_project_id ON project_priority_schemes(project_id);
CREATE INDEX IF NOT EXISTS idx_project_priority_schemes_scheme_id ON project_priority_schemes(scheme_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_preferences_user_id ON dashboard_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_preferences_project_id ON dashboard_preferences(project_id);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_velocity_history_updated_at ON velocity_history;
CREATE TRIGGER trg_velocity_history_updated_at
  BEFORE UPDATE ON velocity_history
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_issue_templates_updated_at ON issue_templates;
CREATE TRIGGER trg_issue_templates_updated_at
  BEFORE UPDATE ON issue_templates
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_priority_schemes_updated_at ON priority_schemes;
CREATE TRIGGER trg_priority_schemes_updated_at
  BEFORE UPDATE ON priority_schemes
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_project_priority_schemes_updated_at ON project_priority_schemes;
CREATE TRIGGER trg_project_priority_schemes_updated_at
  BEFORE UPDATE ON project_priority_schemes
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_dashboard_preferences_updated_at ON dashboard_preferences;
CREATE TRIGGER trg_dashboard_preferences_updated_at
  BEFORE UPDATE ON dashboard_preferences
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

INSERT INTO priority_schemes (name, description, priorities, default_priority, is_default)
SELECT
  'Default Priority Scheme',
  'Backward-compatible priority scheme for existing tasks.',
  '[
    {"name":"Low","icon":"arrow-down","color":"green","sort_order":0},
    {"name":"Medium","icon":"minus","color":"blue","sort_order":1},
    {"name":"High","icon":"arrow-up","color":"orange","sort_order":2},
    {"name":"Urgent","icon":"alert-triangle","color":"red","sort_order":3}
  ]'::JSONB,
  'Medium',
  TRUE
WHERE NOT EXISTS (
  SELECT 1
  FROM priority_schemes
  WHERE is_default = TRUE
);

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_priority_allowed;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'tasks_priority_not_empty'
      AND conrelid = 'tasks'::regclass
  ) THEN
    ALTER TABLE tasks
      ADD CONSTRAINT tasks_priority_not_empty
      CHECK (priority IS NULL OR length(trim(priority)) > 0);
  END IF;
END;
$$;
