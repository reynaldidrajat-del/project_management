ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

UPDATE users
SET password_hash = 'sha256:3d7bcc373a2ca97559179ca882c81d369aa5a01525fb8a15bc8f79e11e71fe4a'
WHERE password_hash IS NULL OR trim(password_hash) = '';

ALTER TABLE users
  ALTER COLUMN password_hash SET DEFAULT 'sha256:3d7bcc373a2ca97559179ca882c81d369aa5a01525fb8a15bc8f79e11e71fe4a',
  ALTER COLUMN password_hash SET NOT NULL;

INSERT INTO users (name, email, role, password_hash, department_id)
VALUES (
  'Super Admin',
  'superadmin@project-management.local',
  'super_admin',
  'sha256:3d7bcc373a2ca97559179ca882c81d369aa5a01525fb8a15bc8f79e11e71fe4a',
  NULL
)
ON CONFLICT (email)
DO UPDATE SET
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  password_hash = EXCLUDED.password_hash;
