DO $$
DECLARE
  human_capital_id INTEGER;
  tamara_user_id INTEGER;
  project_id_value INTEGER;
  documentation_bucket_id INTEGER;
  ui_bucket_id INTEGER;
  programming_bucket_id INTEGER;
  documentation_parent_id INTEGER;
  ui_parent_id INTEGER;
  programming_parent_id INTEGER;
BEGIN
  SELECT id INTO human_capital_id
  FROM departments
  WHERE name = 'Human Capital'
  ORDER BY id
  LIMIT 1;

  IF human_capital_id IS NULL THEN
    INSERT INTO departments (name)
    VALUES ('Human Capital')
    RETURNING id INTO human_capital_id;
  END IF;

  SELECT id INTO tamara_user_id
  FROM users
  WHERE name = 'Tamara Tan'
  ORDER BY id
  LIMIT 1;

  IF tamara_user_id IS NULL THEN
    INSERT INTO users (name, email, role, department_id)
    VALUES ('Tamara Tan', NULL, 'admin', human_capital_id)
    RETURNING id INTO tamara_user_id;
  ELSE
    UPDATE users
    SET department_id = COALESCE(department_id, human_capital_id)
    WHERE id = tamara_user_id;
  END IF;

  DELETE FROM projects
  WHERE name = 'LMS Fase 1';

  INSERT INTO projects (name, description, owner_id, start_date, end_date, status, progress)
  VALUES (
    'LMS Fase 1',
    'Learning Management System Modernland phase 1 timeline imported from project_timeline_past/LMS fase 1.xlsx.',
    tamara_user_id,
    DATE '2023-11-01',
    DATE '2024-08-05',
    'Completed',
    100
  )
  RETURNING id INTO project_id_value;

  INSERT INTO project_members (project_id, user_id, role)
  VALUES (project_id_value, tamara_user_id, 'owner')
  ON CONFLICT (project_id, user_id) DO UPDATE
  SET role = 'owner';

  INSERT INTO buckets (project_id, name, sort_order)
  VALUES
    (project_id_value, 'Documentation', 1),
    (project_id_value, 'User Interface', 2),
    (project_id_value, 'Programming', 3);

  SELECT id INTO documentation_bucket_id FROM buckets WHERE project_id = project_id_value AND name = 'Documentation';
  SELECT id INTO ui_bucket_id FROM buckets WHERE project_id = project_id_value AND name = 'User Interface';
  SELECT id INTO programming_bucket_id FROM buckets WHERE project_id = project_id_value AND name = 'Programming';

  INSERT INTO tasks (
    project_id, bucket_id, parent_task_id, title, description, assignee_id, lead_name, lead_id,
    start_date, end_date, duration_days, work_days, progress, status, priority, sort_order
  )
  VALUES (
    project_id_value, documentation_bucket_id, NULL, 'Documentation', 'WBS 1',
    tamara_user_id, 'Tamara Tan', tamara_user_id,
    DATE '2023-11-01', DATE '2024-01-19',
    calculate_duration_days_sql(DATE '2023-11-01', DATE '2024-01-19'),
    calculate_work_days_sql(DATE '2023-11-01', DATE '2024-01-19'),
    100, 'Done', 'Medium', 1
  )
  RETURNING id INTO documentation_parent_id;

  INSERT INTO tasks (
    project_id, bucket_id, parent_task_id, title, description, assignee_id, lead_name, lead_id,
    start_date, end_date, duration_days, work_days, progress, status, priority, sort_order
  )
  VALUES (
    project_id_value, ui_bucket_id, NULL, 'User Interface', 'WBS 2',
    tamara_user_id, 'Tamara Tan', tamara_user_id,
    DATE '2024-01-01', DATE '2024-03-01',
    calculate_duration_days_sql(DATE '2024-01-01', DATE '2024-03-01'),
    calculate_work_days_sql(DATE '2024-01-01', DATE '2024-03-01'),
    100, 'Done', 'Medium', 2
  )
  RETURNING id INTO ui_parent_id;

  INSERT INTO tasks (
    project_id, bucket_id, parent_task_id, title, description, assignee_id, lead_name, lead_id,
    start_date, end_date, duration_days, work_days, progress, status, priority, sort_order
  )
  VALUES (
    project_id_value, programming_bucket_id, NULL, 'Programming', 'WBS 3. Original Excel text: Progamming.',
    tamara_user_id, 'Tamara Tan', tamara_user_id,
    DATE '2023-12-04', DATE '2024-08-05',
    calculate_duration_days_sql(DATE '2023-12-04', DATE '2024-08-05'),
    calculate_work_days_sql(DATE '2023-12-04', DATE '2024-08-05'),
    100, 'Done', 'Medium', 3
  )
  RETURNING id INTO programming_parent_id;

  INSERT INTO tasks (
    project_id, bucket_id, parent_task_id, title, description, assignee_id, lead_name, lead_id,
    start_date, end_date, duration_days, work_days, progress, status, priority, sort_order
  )
  SELECT
    project_id_value,
    task_data.bucket_id,
    task_data.parent_task_id,
    task_data.title,
    task_data.wbs_code,
    tamara_user_id,
    'Tamara Tan',
    tamara_user_id,
    task_data.start_date,
    task_data.end_date,
    calculate_duration_days_sql(task_data.start_date, task_data.end_date),
    calculate_work_days_sql(task_data.start_date, task_data.end_date),
    100,
    'Done',
    'Medium',
    task_data.sort_order
  FROM (
    VALUES
      (documentation_bucket_id, documentation_parent_id, '1.1', 'Meeting Concept', DATE '2023-11-01', DATE '2023-11-03', 11),
      (documentation_bucket_id, documentation_parent_id, '1.2', 'BRD concept', DATE '2023-11-06', DATE '2023-11-08', 12),
      (documentation_bucket_id, documentation_parent_id, '1.3', 'Project Backgrouund', DATE '2023-11-08', DATE '2023-11-14', 13),
      (documentation_bucket_id, documentation_parent_id, '1.4', 'Business Pocess & Requrement Scope', DATE '2023-11-15', DATE '2023-11-24', 14),
      (documentation_bucket_id, documentation_parent_id, '1.5', 'Functional Requirements', DATE '2023-11-24', DATE '2023-12-01', 15),
      (documentation_bucket_id, documentation_parent_id, '1.6', 'Use Case Flow & Specification', DATE '2023-12-01', DATE '2023-12-15', 16),
      (documentation_bucket_id, documentation_parent_id, '1.7', 'User Activity Diagram', DATE '2023-12-15', DATE '2023-12-27', 17),
      (documentation_bucket_id, documentation_parent_id, '1.8', 'Data Architecture', DATE '2023-12-27', DATE '2023-12-29', 18),
      (documentation_bucket_id, documentation_parent_id, '1.9', 'User Interface Digitalization.', DATE '2024-01-11', DATE '2024-01-19', 19),
      (ui_bucket_id, ui_parent_id, '2.1', 'Brainstorming', DATE '2024-01-01', DATE '2024-01-02', 21),
      (ui_bucket_id, ui_parent_id, '2.2', 'Pengumpulan & Pembuatan Asset', DATE '2024-01-05', DATE '2024-01-07', 22),
      (ui_bucket_id, ui_parent_id, '2.3', 'Pembuatan Home Page & Login', DATE '2024-01-08', DATE '2024-01-12', 23),
      (ui_bucket_id, ui_parent_id, '2.4', 'Pembuatan mock-up Admin', DATE '2024-01-27', DATE '2024-02-07', 24),
      (ui_bucket_id, ui_parent_id, '2.5', 'Pembuatan mock-up user', DATE '2024-02-08', DATE '2024-02-19', 25),
      (ui_bucket_id, ui_parent_id, '2.6', 'Pembuatan mock-up HR & Admin', DATE '2024-02-20', DATE '2024-02-29', 26),
      (ui_bucket_id, ui_parent_id, '2.7', 'Finalisasi', DATE '2024-03-01', DATE '2024-03-01', 27),
      (programming_bucket_id, programming_parent_id, '3.1', 'Learning Boostrap & Framework', DATE '2023-12-04', DATE '2023-12-07', 31),
      (programming_bucket_id, programming_parent_id, '3.2', 'Pembuatan Portofolio', DATE '2023-12-12', DATE '2023-12-23', 32),
      (programming_bucket_id, programming_parent_id, '3.3', 'Pembuatan Resources', DATE '2024-03-05', DATE '2024-03-14', 33),
      (programming_bucket_id, programming_parent_id, '3.4', 'Pembuatan User Page', DATE '2024-03-07', DATE '2024-03-26', 34),
      (programming_bucket_id, programming_parent_id, '3.5', 'Pembuatan HR & Admin Page', DATE '2024-03-26', DATE '2024-04-24', 35),
      (programming_bucket_id, programming_parent_id, '3.6', 'Tambahan fitur User dari HR', DATE '2024-05-27', DATE '2024-06-25', 36),
      (programming_bucket_id, programming_parent_id, '3.7', 'Tambahan fitur HR dari HR', DATE '2024-06-28', DATE '2024-07-26', 37),
      (programming_bucket_id, programming_parent_id, '3.8', 'Testing Apps', DATE '2024-07-26', DATE '2024-08-05', 38)
  ) AS task_data(bucket_id, parent_task_id, wbs_code, title, start_date, end_date, sort_order);

  INSERT INTO task_assignees (task_id, user_id)
  SELECT id, tamara_user_id
  FROM tasks
  WHERE project_id = project_id_value
  ON CONFLICT (task_id, user_id) DO NOTHING;
END $$;
