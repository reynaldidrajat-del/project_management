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
  password_hash VARCHAR(255) NOT NULL DEFAULT 'sha256:3d7bcc373a2ca97559179ca882c81d369aa5a01525fb8a15bc8f79e11e71fe4a',
  department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
  location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS task_attachments (
  id SERIAL PRIMARY KEY,
  task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
  file_name VARCHAR(255),
  file_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  description TEXT,
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
CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects(owner_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_buckets_project_id ON buckets(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_bucket_id ON tasks(bucket_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_task_id ON tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_lead_id ON tasks(lead_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_dates ON tasks(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_tasks_actual_dates ON tasks(actual_start_date, actual_end_date);
CREATE INDEX IF NOT EXISTS idx_task_assignees_task_id ON task_assignees(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_user_id ON task_assignees(user_id);
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
  FOREACH table_name IN ARRAY ARRAY['departments', 'locations', 'users', 'projects', 'project_members', 'buckets', 'tasks', 'task_assignees', 'calendar_exceptions']
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
