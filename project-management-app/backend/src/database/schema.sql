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
  CONSTRAINT tasks_priority_allowed CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
  CONSTRAINT tasks_parent_not_self CHECK (parent_task_id IS NULL OR parent_task_id <> id),
  CONSTRAINT tasks_actual_dates_order CHECK (actual_start_date IS NULL OR actual_end_date IS NULL OR actual_start_date <= actual_end_date),
  CONSTRAINT tasks_realization_mode_allowed CHECK (realization_mode IS NULL OR realization_mode IN ('normal', 'manual'))
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

CREATE INDEX IF NOT EXISTS idx_users_department_id ON users(department_id);
CREATE INDEX IF NOT EXISTS idx_users_location_id ON users(location_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_sessions_token_hash ON auth_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_password_reset_tokens_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects(owner_id);
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
CREATE INDEX IF NOT EXISTS idx_task_assignees_task_id ON task_assignees(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_user_id ON task_assignees(user_id);
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
  FOREACH table_name IN ARRAY ARRAY['departments', 'locations', 'users', 'projects', 'project_members', 'buckets', 'tasks', 'task_assignees', 'task_comments', 'task_labels', 'task_checklists', 'notification_preferences', 'chat_rooms', 'calendar_exceptions']
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
