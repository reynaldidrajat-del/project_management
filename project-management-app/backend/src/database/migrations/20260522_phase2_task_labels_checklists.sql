ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS creator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS archived_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS due_reminder_sent_at TIMESTAMP NULL;

ALTER TABLE buckets
  ADD COLUMN IF NOT EXISTS type VARCHAR(30) DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS color VARCHAR(30) DEFAULT 'slate',
  ADD COLUMN IF NOT EXISTS is_done_bucket BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS move_permission_role VARCHAR(40) DEFAULT 'member',
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP NULL;

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

INSERT INTO role_permissions (role, resource, action, allowed)
VALUES
  ('admin', 'task_label', '*', TRUE),
  ('admin', 'task_checklist', '*', TRUE),
  ('manager', 'task_label', '*', TRUE),
  ('manager', 'task_checklist', '*', TRUE),
  ('contributor', 'task_checklist', 'create', TRUE),
  ('contributor', 'task_checklist', 'update', TRUE),
  ('contributor', 'task_checklist', 'delete', TRUE),
  ('member', 'task_checklist', 'create', TRUE),
  ('member', 'task_checklist', 'update', TRUE),
  ('member', 'task_checklist', 'delete', TRUE)
ON CONFLICT (role, resource, action) DO UPDATE
SET allowed = EXCLUDED.allowed;

CREATE INDEX IF NOT EXISTS idx_tasks_creator_id ON tasks(creator_id);
CREATE INDEX IF NOT EXISTS idx_tasks_archived_at ON tasks(archived_at);
CREATE INDEX IF NOT EXISTS idx_buckets_archived_at ON buckets(archived_at);
CREATE INDEX IF NOT EXISTS idx_task_labels_project_id ON task_labels(project_id);
CREATE INDEX IF NOT EXISTS idx_task_label_assignments_task_id ON task_label_assignments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_label_assignments_label_id ON task_label_assignments(label_id);
CREATE INDEX IF NOT EXISTS idx_task_checklists_task_id ON task_checklists(task_id);
CREATE INDEX IF NOT EXISTS idx_task_checklists_parent_id ON task_checklists(parent_checklist_id);

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['task_labels', 'task_checklists']
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
