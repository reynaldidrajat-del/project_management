DO $$
DECLARE
  project_id_value INTEGER;
  bucket_record RECORD;
  parent_task_id_value INTEGER;
  parent_assignee_id INTEGER;
  parent_lead_id INTEGER;
  parent_lead_name VARCHAR(100);
  parent_start_date DATE;
  parent_end_date DATE;
  parent_sort_order INTEGER;
BEGIN
  SELECT id INTO project_id_value
  FROM projects
  WHERE name = 'AMS (Asset Management System)'
  ORDER BY id
  LIMIT 1;

  IF project_id_value IS NULL THEN
    RAISE EXCEPTION 'Project AMS (Asset Management System) tidak ditemukan.';
  END IF;

  FOR bucket_record IN
    SELECT id, name, sort_order
    FROM buckets
    WHERE project_id = project_id_value
    ORDER BY sort_order, id
  LOOP
    SELECT id INTO parent_task_id_value
    FROM tasks
    WHERE project_id = project_id_value
      AND bucket_id = bucket_record.id
      AND parent_task_id IS NULL
      AND title = bucket_record.name
    ORDER BY id
    LIMIT 1;

    SELECT
      (array_agg(assignee_id ORDER BY start_date NULLS LAST, id) FILTER (WHERE assignee_id IS NOT NULL))[1],
      (array_agg(lead_id ORDER BY start_date NULLS LAST, id) FILTER (WHERE lead_id IS NOT NULL))[1],
      (array_agg(lead_name ORDER BY start_date NULLS LAST, id) FILTER (WHERE lead_name IS NOT NULL))[1],
      MIN(start_date),
      MAX(end_date),
      COALESCE(MIN(sort_order), 0)
    INTO
      parent_assignee_id,
      parent_lead_id,
      parent_lead_name,
      parent_start_date,
      parent_end_date,
      parent_sort_order
    FROM tasks
    WHERE project_id = project_id_value
      AND bucket_id = bucket_record.id
      AND id <> COALESCE(parent_task_id_value, -1)
      AND title <> bucket_record.name;

    IF parent_task_id_value IS NULL THEN
      INSERT INTO tasks (
        project_id,
        bucket_id,
        parent_task_id,
        title,
        description,
        assignee_id,
        lead_name,
        lead_id,
        start_date,
        end_date,
        duration_days,
        work_days,
        progress,
        status,
        priority,
        sort_order
      )
      VALUES (
        project_id_value,
        bucket_record.id,
        NULL,
        bucket_record.name,
        'Parent task otomatis untuk bucket ' || bucket_record.name || '.',
        parent_assignee_id,
        parent_lead_name,
        parent_lead_id,
        parent_start_date,
        parent_end_date,
        calculate_duration_days_sql(parent_start_date, parent_end_date),
        calculate_work_days_sql(parent_start_date, parent_end_date),
        100,
        'Done',
        'Medium',
        parent_sort_order - 1000
      )
      RETURNING id INTO parent_task_id_value;
    ELSE
      UPDATE tasks
      SET
        start_date = parent_start_date,
        end_date = parent_end_date,
        duration_days = calculate_duration_days_sql(parent_start_date, parent_end_date),
        work_days = calculate_work_days_sql(parent_start_date, parent_end_date),
        progress = 100,
        status = 'Done',
        sort_order = parent_sort_order - 1000
      WHERE id = parent_task_id_value;
    END IF;

    UPDATE tasks
    SET parent_task_id = parent_task_id_value
    WHERE project_id = project_id_value
      AND bucket_id = bucket_record.id
      AND parent_task_id IS NULL
      AND id <> parent_task_id_value;

    INSERT INTO task_assignees (task_id, user_id)
    SELECT parent_task_id_value, user_id
    FROM (
      SELECT DISTINCT task_assignee.user_id
      FROM task_assignees task_assignee
      INNER JOIN tasks task_item ON task_item.id = task_assignee.task_id
      WHERE task_item.project_id = project_id_value
        AND task_item.bucket_id = bucket_record.id
        AND task_item.id <> parent_task_id_value
    ) bucket_users
    ON CONFLICT (task_id, user_id) DO NOTHING;
  END LOOP;
END $$;
