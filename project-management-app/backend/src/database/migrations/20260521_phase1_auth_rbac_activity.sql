ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS invitation_accepted_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;

ALTER TABLE users
  ALTER COLUMN password_hash SET DEFAULT '$2b$10$1Zcukrhj9jGONB.D6RD0TOvW8J.lonOZxwT9opnVMXHXkubaFWn4y';

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

CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_sessions_token_hash ON auth_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_password_reset_tokens_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);

CREATE TABLE IF NOT EXISTS role_permissions (
  id SERIAL PRIMARY KEY,
  role VARCHAR(40) NOT NULL,
  resource VARCHAR(80) NOT NULL,
  action VARCHAR(80) NOT NULL,
  allowed BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT role_permissions_unique_rule UNIQUE (role, resource, action)
);

INSERT INTO role_permissions (role, resource, action, allowed)
VALUES
  ('super_admin', '*', '*', TRUE),
  ('admin', '*', 'read', TRUE),
  ('admin', 'project', '*', TRUE),
  ('admin', 'task', '*', TRUE),
  ('admin', 'bucket', '*', TRUE),
  ('admin', 'calendar', '*', TRUE),
  ('admin', 'department', '*', TRUE),
  ('admin', 'location', '*', TRUE),
  ('admin', 'user', '*', TRUE),
  ('admin', 'activity', 'read', TRUE),
  ('manager', '*', 'read', TRUE),
  ('manager', 'project', '*', TRUE),
  ('manager', 'task', '*', TRUE),
  ('manager', 'bucket', '*', TRUE),
  ('manager', 'calendar', '*', TRUE),
  ('manager', 'activity', 'read', TRUE),
  ('contributor', '*', 'read', TRUE),
  ('contributor', 'task', 'create', TRUE),
  ('contributor', 'task', 'update', TRUE),
  ('contributor', 'task', 'move', TRUE),
  ('contributor', 'task', 'progress', TRUE),
  ('contributor', 'task', 'realization', TRUE),
  ('contributor', 'task', 'approve', TRUE),
  ('contributor', 'activity', 'read', TRUE),
  ('member', '*', 'read', TRUE),
  ('member', 'task', 'create', TRUE),
  ('member', 'task', 'update', TRUE),
  ('member', 'task', 'move', TRUE),
  ('member', 'task', 'progress', TRUE),
  ('member', 'task', 'realization', TRUE),
  ('member', 'task', 'approve', TRUE),
  ('member', 'activity', 'read', TRUE),
  ('viewer', '*', 'read', TRUE),
  ('viewer', 'activity', 'read', TRUE)
ON CONFLICT (role, resource, action) DO UPDATE
SET allowed = EXCLUDED.allowed;

ALTER TABLE activity_logs
  ADD COLUMN IF NOT EXISTS actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS object_type VARCHAR(80),
  ADD COLUMN IF NOT EXISTS object_id INTEGER,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS ip_address VARCHAR(80),
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

UPDATE activity_logs
SET actor_user_id = user_id
WHERE actor_user_id IS NULL
  AND user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_logs_actor_user_id ON activity_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_object ON activity_logs(object_type, object_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_project_id ON activity_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_task_id ON activity_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
