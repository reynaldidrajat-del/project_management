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

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_rooms_unique_project
  ON chat_rooms(project_id)
  WHERE type = 'project' AND project_id IS NOT NULL AND archived_at IS NULL;

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

DROP TRIGGER IF EXISTS trg_chat_rooms_updated_at ON chat_rooms;
CREATE TRIGGER trg_chat_rooms_updated_at
BEFORE UPDATE ON chat_rooms
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO role_permissions (role, resource, action, allowed)
VALUES
  ('admin', 'chat', '*', TRUE),
  ('manager', 'chat', '*', TRUE),
  ('contributor', 'chat', 'read', TRUE),
  ('contributor', 'chat', 'create', TRUE),
  ('contributor', 'chat', 'update', TRUE),
  ('contributor', 'chat', 'delete', TRUE),
  ('member', 'chat', 'read', TRUE),
  ('member', 'chat', 'create', TRUE),
  ('member', 'chat', 'update', TRUE),
  ('member', 'chat', 'delete', TRUE),
  ('viewer', 'chat', 'read', TRUE)
ON CONFLICT (role, resource, action) DO UPDATE SET allowed = EXCLUDED.allowed;
