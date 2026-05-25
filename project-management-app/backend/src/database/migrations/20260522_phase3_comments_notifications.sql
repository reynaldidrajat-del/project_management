BEGIN;

ALTER TABLE task_comments
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS deleted_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

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

DROP TRIGGER IF EXISTS trg_task_comments_updated_at ON task_comments;
CREATE TRIGGER trg_task_comments_updated_at
BEFORE UPDATE ON task_comments
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_notification_preferences_updated_at ON notification_preferences;
CREATE TRIGGER trg_notification_preferences_updated_at
BEFORE UPDATE ON notification_preferences
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO role_permissions (role, resource, action, allowed)
VALUES
  ('admin', 'task_comment', '*', TRUE),
  ('admin', 'notification', '*', TRUE),
  ('manager', 'task_comment', '*', TRUE),
  ('manager', 'notification', '*', TRUE),
  ('contributor', 'task_comment', 'create', TRUE),
  ('contributor', 'task_comment', 'update', TRUE),
  ('contributor', 'task_comment', 'delete', TRUE),
  ('contributor', 'notification', 'read', TRUE),
  ('contributor', 'notification', 'update', TRUE),
  ('member', 'task_comment', 'create', TRUE),
  ('member', 'task_comment', 'update', TRUE),
  ('member', 'task_comment', 'delete', TRUE),
  ('member', 'notification', 'read', TRUE),
  ('member', 'notification', 'update', TRUE),
  ('viewer', 'task_comment', 'read', TRUE),
  ('viewer', 'notification', 'read', TRUE),
  ('viewer', 'notification', 'update', TRUE)
ON CONFLICT (role, resource, action)
DO UPDATE SET allowed = EXCLUDED.allowed;

COMMIT;
