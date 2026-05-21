DO $$
DECLARE
  project_id_value INTEGER;
  rey_user_id INTEGER;
  kevin_user_id INTEGER;
  fandra_user_id INTEGER;
  olin_user_id INTEGER;
BEGIN
  SELECT id INTO project_id_value
  FROM projects
  WHERE name = 'LMS Fase 1'
  ORDER BY id
  LIMIT 1;

  IF project_id_value IS NULL THEN
    RAISE EXCEPTION 'Project LMS Fase 1 tidak ditemukan.';
  END IF;

  SELECT id INTO rey_user_id FROM users WHERE lower(name) = 'rey' ORDER BY id LIMIT 1;
  SELECT id INTO kevin_user_id FROM users WHERE lower(name) = 'kevin' ORDER BY id LIMIT 1;
  SELECT id INTO fandra_user_id FROM users WHERE lower(name) = 'fandra' ORDER BY id LIMIT 1;
  SELECT id INTO olin_user_id FROM users WHERE lower(name) = 'olin' ORDER BY id LIMIT 1;

  IF rey_user_id IS NULL OR kevin_user_id IS NULL OR fandra_user_id IS NULL OR olin_user_id IS NULL THEN
    RAISE EXCEPTION 'User Rey, Kevin, Fandra, atau Olin tidak lengkap.';
  END IF;

  UPDATE tasks task_item
  SET
    assignee_id = rey_user_id,
    lead_id = rey_user_id,
    lead_name = 'Rey'
  FROM buckets bucket
  WHERE bucket.id = task_item.bucket_id
    AND task_item.project_id = project_id_value
    AND bucket.name = 'Documentation';

  DELETE FROM task_assignees task_assignee
  USING tasks task_item, buckets bucket
  WHERE task_assignee.task_id = task_item.id
    AND bucket.id = task_item.bucket_id
    AND task_item.project_id = project_id_value
    AND bucket.name = 'Documentation';

  INSERT INTO task_assignees (task_id, user_id)
  SELECT task_item.id, rey_user_id
  FROM tasks task_item
  INNER JOIN buckets bucket ON bucket.id = task_item.bucket_id
  WHERE task_item.project_id = project_id_value
    AND bucket.name = 'Documentation'
  ON CONFLICT (task_id, user_id) DO NOTHING;

  UPDATE tasks task_item
  SET
    assignee_id = kevin_user_id,
    lead_id = kevin_user_id,
    lead_name = 'Kevin'
  FROM buckets bucket
  WHERE bucket.id = task_item.bucket_id
    AND task_item.project_id = project_id_value
    AND bucket.name = 'Programming';

  DELETE FROM task_assignees task_assignee
  USING tasks task_item, buckets bucket
  WHERE task_assignee.task_id = task_item.id
    AND bucket.id = task_item.bucket_id
    AND task_item.project_id = project_id_value
    AND bucket.name = 'Programming';

  INSERT INTO task_assignees (task_id, user_id)
  SELECT task_item.id, kevin_user_id
  FROM tasks task_item
  INNER JOIN buckets bucket ON bucket.id = task_item.bucket_id
  WHERE task_item.project_id = project_id_value
    AND bucket.name = 'Programming'
  ON CONFLICT (task_id, user_id) DO NOTHING;

  UPDATE tasks task_item
  SET
    assignee_id = fandra_user_id,
    lead_id = fandra_user_id,
    lead_name = 'Fandra'
  FROM buckets bucket
  WHERE bucket.id = task_item.bucket_id
    AND task_item.project_id = project_id_value
    AND bucket.name = 'User Interface';

  DELETE FROM task_assignees task_assignee
  USING tasks task_item, buckets bucket
  WHERE task_assignee.task_id = task_item.id
    AND bucket.id = task_item.bucket_id
    AND task_item.project_id = project_id_value
    AND bucket.name = 'User Interface';

  INSERT INTO task_assignees (task_id, user_id)
  SELECT task_item.id, fandra_user_id
  FROM tasks task_item
  INNER JOIN buckets bucket ON bucket.id = task_item.bucket_id
  WHERE task_item.project_id = project_id_value
    AND bucket.name = 'User Interface'
  ON CONFLICT (task_id, user_id) DO NOTHING;

  INSERT INTO task_assignees (task_id, user_id)
  SELECT task_item.id, olin_user_id
  FROM tasks task_item
  INNER JOIN buckets bucket ON bucket.id = task_item.bucket_id
  WHERE task_item.project_id = project_id_value
    AND bucket.name = 'User Interface'
  ON CONFLICT (task_id, user_id) DO NOTHING;

  INSERT INTO project_members (project_id, user_id, role)
  VALUES
    (project_id_value, rey_user_id, 'member'),
    (project_id_value, kevin_user_id, 'member'),
    (project_id_value, fandra_user_id, 'member'),
    (project_id_value, olin_user_id, 'member')
  ON CONFLICT (project_id, user_id) DO UPDATE
  SET role = CASE
    WHEN project_members.role = 'owner' THEN 'owner'
    ELSE EXCLUDED.role
  END;
END $$;
