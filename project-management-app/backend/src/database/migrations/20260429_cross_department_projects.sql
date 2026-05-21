CREATE TABLE IF NOT EXISTS project_members (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'member',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT project_members_unique_user UNIQUE (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON project_members(user_id);

INSERT INTO project_members (project_id, user_id, role)
SELECT id, owner_id, 'owner'
FROM projects
WHERE owner_id IS NOT NULL
ON CONFLICT (project_id, user_id) DO UPDATE
SET role = CASE
  WHEN project_members.role = 'owner' THEN 'owner'
  ELSE EXCLUDED.role
END;

INSERT INTO project_members (project_id, user_id, role)
SELECT DISTINCT project_id, assignee_id, 'member'
FROM tasks
WHERE assignee_id IS NOT NULL
ON CONFLICT (project_id, user_id) DO NOTHING;

DROP INDEX IF EXISTS idx_projects_department_id;
ALTER TABLE projects DROP COLUMN IF EXISTS department_id;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_project_members_updated_at ON project_members;
CREATE TRIGGER trg_project_members_updated_at
BEFORE UPDATE ON project_members
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
