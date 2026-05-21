ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS lead_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS task_assignees (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT task_assignees_unique_user UNIQUE (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tasks_lead_id ON tasks(lead_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_task_id ON task_assignees(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_user_id ON task_assignees(user_id);

INSERT INTO task_assignees (task_id, user_id)
SELECT id, assignee_id
FROM tasks
WHERE assignee_id IS NOT NULL
ON CONFLICT (task_id, user_id) DO NOTHING;

UPDATE tasks t
SET lead_id = u.id
FROM users u
WHERE t.lead_id IS NULL
  AND t.lead_name IS NOT NULL
  AND lower(trim(t.lead_name)) = lower(trim(u.name));

INSERT INTO project_members (project_id, user_id, role)
SELECT DISTINCT t.project_id, ta.user_id, 'member'
FROM task_assignees ta
INNER JOIN tasks t ON t.id = ta.task_id
WHERE t.project_id IS NOT NULL
ON CONFLICT (project_id, user_id) DO NOTHING;

INSERT INTO project_members (project_id, user_id, role)
SELECT DISTINCT project_id, lead_id, 'lead'
FROM tasks
WHERE project_id IS NOT NULL
  AND lead_id IS NOT NULL
ON CONFLICT (project_id, user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_task_assignees_updated_at ON task_assignees;
CREATE TRIGGER trg_task_assignees_updated_at
BEFORE UPDATE ON task_assignees
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
