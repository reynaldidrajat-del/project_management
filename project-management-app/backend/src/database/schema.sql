CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS locations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE,
  role VARCHAR(30) DEFAULT 'admin',
  password_hash VARCHAR(255) NOT NULL DEFAULT '$2b$10$1Zcukrhj9jGONB.D6RD0TOvW8J.lonOZxwT9opnVMXHXkubaFWn4y',
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at TIMESTAMP NULL,
  invited_at TIMESTAMP NULL,
  invitation_accepted_at TIMESTAMP NULL,
  deleted_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  user_agent TEXT,
  ip_address VARCHAR(80),
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id SERIAL PRIMARY KEY,
  role VARCHAR(40) NOT NULL,
  resource VARCHAR(80) NOT NULL,
  action VARCHAR(80) NOT NULL,
  allowed BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT role_permissions_unique_rule UNIQUE (role, resource, action)
);

CREATE TABLE IF NOT EXISTS projects (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  project_key VARCHAR(10),
  start_date DATE,
  end_date DATE,
  status VARCHAR(30) DEFAULT 'Planning',
  progress INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT projects_progress_range CHECK (progress >= 0 AND progress <= 100),
  CONSTRAINT projects_status_allowed CHECK (status IN ('Planning', 'Active', 'On Hold', 'Completed', 'Cancelled'))
);

CREATE TABLE IF NOT EXISTS project_members (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'member',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT project_members_unique_user UNIQUE (project_id, user_id)
);

CREATE TABLE IF NOT EXISTS buckets (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  type VARCHAR(30) DEFAULT 'normal',
  color VARCHAR(30) DEFAULT 'slate',
  is_done_bucket BOOLEAN DEFAULT FALSE,
  move_permission_role VARCHAR(40) DEFAULT 'member',
  archived_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  bucket_id INTEGER REFERENCES buckets(id) ON DELETE SET NULL,
  parent_task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  lead_name VARCHAR(100),
  lead_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  start_date DATE,
  end_date DATE,
  duration_days INTEGER DEFAULT 0,
  work_days INTEGER DEFAULT 0,
  actual_start_date DATE,
  actual_end_date DATE,
  actual_duration_days INTEGER DEFAULT 0,
  actual_work_days INTEGER DEFAULT 0,
  realization_mode VARCHAR(20),
  progress INTEGER DEFAULT 0,
  status VARCHAR(30) DEFAULT 'Not Started',
  priority VARCHAR(30) DEFAULT 'Medium',
  sort_order INTEGER DEFAULT 0,
  creator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  -- Jira parity columns for issue management
  issue_type_id INTEGER,
  issue_key VARCHAR(50),
  story_points INTEGER,
  epic_id INTEGER,
  sprint_id INTEGER,
  workflow_state_id INTEGER,
  resolution VARCHAR(100),
  environment TEXT,
  affects_versions TEXT[],
  fix_versions TEXT[],
  components TEXT[],
  backlog_order INTEGER,
  original_estimate_minutes INTEGER DEFAULT 0,
  remaining_estimate_minutes INTEGER DEFAULT 0,
  -- End Jira parity columns
  archived_at TIMESTAMP NULL,
  archived_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  deleted_at TIMESTAMP NULL,
  deleted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  completed_at TIMESTAMP NULL,
  approved_at TIMESTAMP NULL,
  approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  due_reminder_sent_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT tasks_progress_range CHECK (progress >= 0 AND progress <= 100),
  CONSTRAINT tasks_status_allowed CHECK (status IN ('Not Started', 'In Progress', 'Waiting Review', 'Done', 'Overdue')),
  CONSTRAINT tasks_priority_not_empty CHECK (priority IS NULL OR length(trim(priority)) > 0),
  CONSTRAINT tasks_parent_not_self CHECK (parent_task_id IS NULL OR parent_task_id <> id),
  CONSTRAINT tasks_actual_dates_order CHECK (actual_start_date IS NULL OR actual_end_date IS NULL OR actual_start_date <= actual_end_date),
  CONSTRAINT tasks_realization_mode_allowed CHECK (realization_mode IS NULL OR realization_mode IN ('normal', 'manual')),
  CONSTRAINT tasks_story_points_non_negative CHECK (story_points IS NULL OR story_points >= 0),
  CONSTRAINT tasks_original_estimate_non_negative CHECK (original_estimate_minutes >= 0),
  CONSTRAINT tasks_remaining_estimate_non_negative CHECK (remaining_estimate_minutes >= 0)
);

CREATE TABLE IF NOT EXISTS task_assignees (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT task_assignees_unique_user UNIQUE (task_id, user_id)
);

CREATE TABLE IF NOT EXISTS task_comments (
  id SERIAL PRIMARY KEY,
  task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  comment TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  deleted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS comment_mentions (
  id SERIAL PRIMARY KEY,
  comment_id INTEGER NOT NULL REFERENCES task_comments(id) ON DELETE CASCADE,
  mentioned_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT comment_mentions_unique_user UNIQUE (comment_id, mentioned_user_id)
);

CREATE TABLE IF NOT EXISTS read_receipts (
  id SERIAL PRIMARY KEY,
  object_type VARCHAR(80) NOT NULL,
  object_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT read_receipts_unique_object_user UNIQUE (object_type, object_id, user_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  type VARCHAR(80) NOT NULL,
  resource_type VARCHAR(80),
  resource_id INTEGER,
  task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  title VARCHAR(180) NOT NULL,
  body TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,
  read_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel VARCHAR(40) NOT NULL DEFAULT 'in_app',
  event_type VARCHAR(80) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT notification_preferences_unique_rule UNIQUE (user_id, channel, event_type)
);

CREATE TABLE IF NOT EXISTS chat_rooms (
  id SERIAL PRIMARY KEY,
  type VARCHAR(30) NOT NULL,
  name VARCHAR(150),
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  department_id INTEGER REFERENCES departments(id) ON DELETE CASCADE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  archived_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chat_rooms_type_allowed CHECK (type IN ('project', 'department', 'private', 'company'))
);

CREATE TABLE IF NOT EXISTS chat_room_members (
  id SERIAL PRIMARY KEY,
  room_id INTEGER NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(40) DEFAULT 'member',
  last_read_message_id INTEGER NULL,
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  muted_until TIMESTAMP NULL,
  CONSTRAINT chat_room_members_unique_user UNIQUE (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id SERIAL PRIMARY KEY,
  room_id INTEGER NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  parent_message_id INTEGER REFERENCES chat_messages(id) ON DELETE CASCADE,
  body TEXT,
  message_type VARCHAR(30) DEFAULT 'text',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NULL,
  deleted_at TIMESTAMP NULL,
  deleted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chat_messages_type_allowed CHECK (message_type IN ('text', 'system'))
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chat_room_members_last_read_message_fk'
  ) THEN
    ALTER TABLE chat_room_members
      ADD CONSTRAINT chat_room_members_last_read_message_fk
      FOREIGN KEY (last_read_message_id) REFERENCES chat_messages(id) ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS task_attachments (
  id SERIAL PRIMARY KEY,
  task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
  file_name VARCHAR(255),
  file_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS task_labels (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL,
  color VARCHAR(30) DEFAULT 'slate',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT task_labels_unique_project_name UNIQUE (project_id, name)
);

CREATE TABLE IF NOT EXISTS task_label_assignments (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  label_id INTEGER NOT NULL REFERENCES task_labels(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT task_label_assignments_unique_label UNIQUE (task_id, label_id)
);

CREATE TABLE IF NOT EXISTS task_checklists (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  parent_checklist_id INTEGER REFERENCES task_checklists(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  is_done BOOLEAN DEFAULT FALSE,
  assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  due_date DATE NULL,
  sort_order INTEGER DEFAULT 0,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  completed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  object_type VARCHAR(80),
  object_id INTEGER,
  description TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,
  ip_address VARCHAR(80),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS calendar_exceptions (
  id SERIAL PRIMARY KEY,
  exception_date DATE NOT NULL UNIQUE,
  type VARCHAR(30) NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT calendar_exception_type_allowed CHECK (type IN ('holiday', 'working_day'))
);

-- Jira parity schema
CREATE TABLE IF NOT EXISTS workflows (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

CREATE TABLE IF NOT EXISTS issue_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(50),
  color VARCHAR(30),
  hierarchy_level INTEGER NOT NULL DEFAULT 0,
  allowed_parent_types TEXT[],
  allowed_child_types TEXT[],
  default_workflow_id INTEGER REFERENCES workflows(id) ON DELETE SET NULL,
  is_system BOOLEAN DEFAULT FALSE,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS project_key_sequences (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  current_sequence INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT project_key_sequences_unique_project UNIQUE (project_id)
);

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

CREATE TABLE IF NOT EXISTS releases (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  start_date DATE,
  release_date DATE,
  status VARCHAR(30) DEFAULT 'unreleased',
  released BOOLEAN DEFAULT FALSE,
  released_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT releases_status_allowed CHECK (status IN ('unreleased', 'released', 'archived'))
);

CREATE TABLE IF NOT EXISTS epics (
  id SERIAL PRIMARY KEY,
  issue_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  epic_name VARCHAR(200) NOT NULL,
  epic_color VARCHAR(30) DEFAULT 'purple',
  roadmap_id INTEGER REFERENCES roadmaps(id) ON DELETE SET NULL,
  release_id INTEGER REFERENCES releases(id) ON DELETE SET NULL,
  start_date DATE NULL,
  target_end_date DATE NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT epics_issue_unique UNIQUE (issue_id)
);

CREATE TABLE IF NOT EXISTS custom_fields (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  field_type VARCHAR(50) NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'select', 'multi_select', 'user', 'checkbox', 'url')),
  options JSONB DEFAULT '[]'::JSONB,
  is_required BOOLEAN DEFAULT FALSE,
  default_value TEXT,
  applicable_issue_types TEXT[],
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS custom_field_values (
  id SERIAL PRIMARY KEY,
  issue_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  custom_field_id INTEGER NOT NULL REFERENCES custom_fields(id) ON DELETE CASCADE,
  value TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT custom_field_values_unique UNIQUE (issue_id, custom_field_id)
);

CREATE TABLE IF NOT EXISTS components (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  description TEXT,
  default_assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT components_unique_project_name UNIQUE (project_id, name)
);

CREATE TABLE IF NOT EXISTS issue_components (
  id SERIAL PRIMARY KEY,
  issue_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  component_id INTEGER NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT issue_components_unique_component UNIQUE (issue_id, component_id)
);

CREATE TABLE IF NOT EXISTS issue_links (
  id SERIAL PRIMARY KEY,
  source_issue_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  target_issue_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  link_type VARCHAR(30) NOT NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT issue_links_type_allowed CHECK (link_type IN ('blocks', 'is_blocked_by', 'relates_to', 'duplicates', 'is_duplicated_by')),
  CONSTRAINT issue_links_not_self_referential CHECK (source_issue_id <> target_issue_id)
);

CREATE TABLE IF NOT EXISTS issue_watchers (
  id SERIAL PRIMARY KEY,
  issue_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  auto_watched BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT issue_watchers_unique_issue_user UNIQUE (issue_id, user_id)
);

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

CREATE TABLE IF NOT EXISTS issue_fix_versions (
  id SERIAL PRIMARY KEY,
  issue_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  release_id INTEGER NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT issue_fix_versions_unique UNIQUE (issue_id, release_id)
);

CREATE TABLE IF NOT EXISTS issue_affects_versions (
  id SERIAL PRIMARY KEY,
  issue_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  release_id INTEGER NOT NULL REFERENCES releases(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT issue_affects_versions_unique UNIQUE (issue_id, release_id)
);

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

CREATE TABLE IF NOT EXISTS automation_logs (
  id SERIAL PRIMARY KEY,
  rule_id INTEGER NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  issue_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  status VARCHAR(30) NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
  error_message TEXT,
  execution_time_ms INTEGER,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tasks_issue_type_id_fkey' AND conrelid = 'tasks'::regclass
  ) THEN
    ALTER TABLE tasks
      ADD CONSTRAINT tasks_issue_type_id_fkey
      FOREIGN KEY (issue_type_id) REFERENCES issue_types(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tasks_epic_id_fkey' AND conrelid = 'tasks'::regclass
  ) THEN
    ALTER TABLE tasks
      ADD CONSTRAINT tasks_epic_id_fkey
      FOREIGN KEY (epic_id) REFERENCES epics(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tasks_sprint_id_fkey' AND conrelid = 'tasks'::regclass
  ) THEN
    ALTER TABLE tasks
      ADD CONSTRAINT tasks_sprint_id_fkey
      FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'tasks_workflow_state_id_fkey' AND conrelid = 'tasks'::regclass
  ) THEN
    ALTER TABLE tasks
      ADD CONSTRAINT tasks_workflow_state_id_fkey
      FOREIGN KEY (workflow_state_id) REFERENCES workflow_states(id) ON DELETE SET NULL;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_users_department_id ON users(department_id);
CREATE INDEX IF NOT EXISTS idx_users_location_id ON users(location_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_sessions_token_hash ON auth_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_password_reset_tokens_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects(owner_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_project_key ON projects(project_key) WHERE project_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_buckets_project_id ON buckets(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_bucket_id ON tasks(bucket_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_lead_id ON tasks(lead_id);
CREATE INDEX IF NOT EXISTS idx_tasks_creator_id ON tasks(creator_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_dates ON tasks(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_tasks_actual_dates ON tasks(actual_start_date, actual_end_date);
CREATE INDEX IF NOT EXISTS idx_tasks_archived_at ON tasks(archived_at);
-- Jira parity indexes for issue management
CREATE INDEX IF NOT EXISTS idx_tasks_issue_type_id ON tasks(issue_type_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_issue_key ON tasks(issue_key) WHERE issue_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_epic_id ON tasks(epic_id);
CREATE INDEX IF NOT EXISTS idx_tasks_sprint_id ON tasks(sprint_id);
CREATE INDEX IF NOT EXISTS idx_tasks_workflow_state_id ON tasks(workflow_state_id);
CREATE INDEX IF NOT EXISTS idx_tasks_original_estimate ON tasks(original_estimate_minutes);
CREATE INDEX IF NOT EXISTS idx_tasks_remaining_estimate ON tasks(remaining_estimate_minutes);
CREATE INDEX IF NOT EXISTS idx_tasks_backlog_order ON tasks(project_id, backlog_order) WHERE sprint_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_backlog_project ON tasks(project_id) WHERE sprint_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_project_type_status ON tasks(project_id, issue_type_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_project_workflow_sprint ON tasks(project_id, workflow_state_id, sprint_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_project_updated ON tasks(project_id, updated_at DESC, id DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_project ON tasks(assignee_id, project_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_title_description_fts
  ON tasks
  USING GIN (to_tsvector('simple', COALESCE(title, '') || ' ' || COALESCE(description, '')))
  WHERE deleted_at IS NULL;
-- End Jira parity indexes
CREATE INDEX IF NOT EXISTS idx_task_assignees_task_id ON task_assignees(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_user_id ON task_assignees(user_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_user_task ON task_assignees(user_id, task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_user_id ON task_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_deleted_at ON task_comments(deleted_at);
CREATE INDEX IF NOT EXISTS idx_comment_mentions_comment_id ON comment_mentions(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_mentions_user_id ON comment_mentions(mentioned_user_id);
CREATE INDEX IF NOT EXISTS idx_read_receipts_object ON read_receipts(object_type, object_id);
CREATE INDEX IF NOT EXISTS idx_read_receipts_user_id ON read_receipts(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_actor_user_id ON notifications(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON notifications(read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_task_id ON notifications(task_id);
CREATE INDEX IF NOT EXISTS idx_notifications_project_id ON notifications(project_id);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_rooms_unique_project
  ON chat_rooms(project_id)
  WHERE type = 'project' AND project_id IS NOT NULL AND archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_chat_rooms_type ON chat_rooms(type);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_project_id ON chat_rooms(project_id);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_department_id ON chat_rooms(department_id);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_archived_at ON chat_rooms(archived_at);
CREATE INDEX IF NOT EXISTS idx_chat_room_members_room_id ON chat_room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_room_members_user_id ON chat_room_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_id ON chat_messages(room_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_deleted_at ON chat_messages(deleted_at);
CREATE INDEX IF NOT EXISTS idx_buckets_archived_at ON buckets(archived_at);
CREATE INDEX IF NOT EXISTS idx_task_labels_project_id ON task_labels(project_id);
CREATE INDEX IF NOT EXISTS idx_task_label_assignments_task_id ON task_label_assignments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_label_assignments_label_id ON task_label_assignments(label_id);
CREATE INDEX IF NOT EXISTS idx_task_checklists_task_id ON task_checklists(task_id);
CREATE INDEX IF NOT EXISTS idx_task_checklists_parent_id ON task_checklists(parent_checklist_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor_user_id ON activity_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_object ON activity_logs(object_type, object_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_project_id ON activity_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_task_id ON activity_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_calendar_exceptions_date ON calendar_exceptions(exception_date);
CREATE INDEX IF NOT EXISTS idx_workflows_project_id ON workflows(project_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_workflows_default_per_project
  ON workflows(project_id)
  WHERE is_default = TRUE AND project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workflow_states_workflow_id ON workflow_states(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_states_sort_order ON workflow_states(workflow_id, sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS idx_workflow_states_initial_per_workflow
  ON workflow_states(workflow_id)
  WHERE is_initial = TRUE;
CREATE INDEX IF NOT EXISTS idx_workflow_transitions_workflow_id ON workflow_transitions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_transitions_from_state ON workflow_transitions(from_state_id);
CREATE INDEX IF NOT EXISTS idx_workflow_transitions_to_state ON workflow_transitions(to_state_id);
CREATE INDEX IF NOT EXISTS idx_issue_types_project_id ON issue_types(project_id);
CREATE INDEX IF NOT EXISTS idx_issue_types_is_system ON issue_types(is_system);
CREATE INDEX IF NOT EXISTS idx_issue_types_name ON issue_types(name);
CREATE INDEX IF NOT EXISTS idx_issue_types_default_workflow_id ON issue_types(default_workflow_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_issue_types_unique_name_per_project
  ON issue_types (name, COALESCE(project_id, -1));
CREATE INDEX IF NOT EXISTS idx_project_key_sequences_project_id ON project_key_sequences(project_id);
CREATE INDEX IF NOT EXISTS idx_sprints_project_id ON sprints(project_id);
CREATE INDEX IF NOT EXISTS idx_sprints_state ON sprints(state);
CREATE INDEX IF NOT EXISTS idx_sprints_project_state ON sprints(project_id, state);
CREATE INDEX IF NOT EXISTS idx_roadmaps_project_id ON roadmaps(project_id);
CREATE INDEX IF NOT EXISTS idx_roadmaps_dates ON roadmaps(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_roadmaps_is_default ON roadmaps(is_default);
CREATE UNIQUE INDEX IF NOT EXISTS idx_roadmaps_unique_default
  ON roadmaps(project_id)
  WHERE is_default = TRUE;
CREATE INDEX IF NOT EXISTS idx_releases_project_id ON releases(project_id);
CREATE INDEX IF NOT EXISTS idx_releases_status ON releases(status);
CREATE INDEX IF NOT EXISTS idx_releases_release_date ON releases(release_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_releases_unique_name ON releases(project_id, name);
CREATE INDEX IF NOT EXISTS idx_epics_issue_id ON epics(issue_id);
CREATE INDEX IF NOT EXISTS idx_epics_roadmap_id ON epics(roadmap_id);
CREATE INDEX IF NOT EXISTS idx_epics_release_id ON epics(release_id);
CREATE INDEX IF NOT EXISTS idx_epics_dates ON epics(start_date, target_end_date);
CREATE INDEX IF NOT EXISTS idx_custom_fields_project_id ON custom_fields(project_id);
CREATE INDEX IF NOT EXISTS idx_custom_fields_field_type ON custom_fields(field_type);
CREATE INDEX IF NOT EXISTS idx_custom_fields_sort_order ON custom_fields(sort_order);
CREATE INDEX IF NOT EXISTS idx_custom_field_values_issue_id ON custom_field_values(issue_id);
CREATE INDEX IF NOT EXISTS idx_custom_field_values_custom_field_id ON custom_field_values(custom_field_id);
CREATE INDEX IF NOT EXISTS idx_custom_field_values_field_lower_value ON custom_field_values(custom_field_id, lower(value));
CREATE INDEX IF NOT EXISTS idx_components_project_id ON components(project_id);
CREATE INDEX IF NOT EXISTS idx_components_default_assignee_id ON components(default_assignee_id);
CREATE INDEX IF NOT EXISTS idx_issue_components_issue_id ON issue_components(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_components_component_id ON issue_components(component_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_issue_links_unique ON issue_links(source_issue_id, target_issue_id, link_type);
CREATE INDEX IF NOT EXISTS idx_issue_links_source ON issue_links(source_issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_links_target ON issue_links(target_issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_links_type ON issue_links(link_type);
CREATE INDEX IF NOT EXISTS idx_issue_links_created_by ON issue_links(created_by);
CREATE INDEX IF NOT EXISTS idx_issue_watchers_issue_id ON issue_watchers(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_watchers_user_id ON issue_watchers(user_id);
CREATE INDEX IF NOT EXISTS idx_issue_watchers_added_at ON issue_watchers(added_at);
CREATE INDEX IF NOT EXISTS idx_time_logs_issue_id ON time_logs(issue_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_user_id ON time_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_work_date ON time_logs(work_date);
CREATE INDEX IF NOT EXISTS idx_time_logs_created_at ON time_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_issue_fix_versions_issue_id ON issue_fix_versions(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_fix_versions_release_id ON issue_fix_versions(release_id);
CREATE INDEX IF NOT EXISTS idx_issue_affects_versions_issue_id ON issue_affects_versions(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_affects_versions_release_id ON issue_affects_versions(release_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_project_id ON automation_rules(project_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_is_enabled ON automation_rules(is_enabled);
CREATE INDEX IF NOT EXISTS idx_automation_rules_created_by ON automation_rules(created_by);
CREATE INDEX IF NOT EXISTS idx_automation_logs_rule_id ON automation_logs(rule_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_issue_id ON automation_logs(issue_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_status ON automation_logs(status);
CREATE INDEX IF NOT EXISTS idx_automation_logs_executed_at ON automation_logs(executed_at);
CREATE INDEX IF NOT EXISTS idx_reports_project_id ON reports(project_id);
CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(type);
CREATE INDEX IF NOT EXISTS idx_reports_created_by ON reports(created_by);
CREATE INDEX IF NOT EXISTS idx_reports_is_favorite ON reports(is_favorite);
CREATE INDEX IF NOT EXISTS idx_saved_filters_user_id ON saved_filters(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_filters_is_shared ON saved_filters(is_shared);
CREATE INDEX IF NOT EXISTS idx_saved_filters_is_favorite ON saved_filters(is_favorite);
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

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'departments',
    'locations',
    'users',
    'projects',
    'project_members',
    'buckets',
    'tasks',
    'task_assignees',
    'task_comments',
    'task_labels',
    'task_checklists',
    'notification_preferences',
    'chat_rooms',
    'calendar_exceptions',
    'workflows',
    'workflow_states',
    'workflow_transitions',
    'issue_types',
    'project_key_sequences',
    'sprints',
    'roadmaps',
    'releases',
    'epics',
    'custom_fields',
    'custom_field_values',
    'components',
    'issue_links',
    'time_logs',
    'automation_rules',
    'reports',
    'saved_filters',
    'velocity_history',
    'issue_templates',
    'priority_schemes',
    'project_priority_schemes',
    'dashboard_preferences'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON %I', table_name, table_name);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      table_name,
      table_name
    );
  END LOOP;
END;
$$;

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

CREATE OR REPLACE FUNCTION calculate_duration_days_sql(start_value DATE, end_value DATE)
RETURNS INTEGER AS $$
BEGIN
  IF start_value IS NULL OR end_value IS NULL OR start_value > end_value THEN
    RETURN 0;
  END IF;

  RETURN (end_value - start_value) + 1;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION calculate_work_days_sql(start_value DATE, end_value DATE)
RETURNS INTEGER AS $$
DECLARE
  workday_count INTEGER;
BEGIN
  IF start_value IS NULL OR end_value IS NULL OR start_value > end_value THEN
    RETURN 0;
  END IF;

  SELECT COUNT(*)
  INTO workday_count
  FROM generate_series(start_value, end_value, interval '1 day') AS generated_date(day_value)
  LEFT JOIN calendar_exceptions ce ON ce.exception_date = generated_date.day_value::DATE
  WHERE
    CASE
      WHEN ce.type = 'holiday' THEN FALSE
      WHEN ce.type = 'working_day' THEN TRUE
      ELSE EXTRACT(ISODOW FROM generated_date.day_value) BETWEEN 1 AND 5
    END;

  RETURN workday_count;
END;
$$ LANGUAGE plpgsql;
