TRUNCATE TABLE
  activity_logs,
  task_attachments,
  task_comments,
  task_assignees,
  tasks,
  buckets,
  project_members,
  projects,
  users,
  locations,
  departments,
  calendar_exceptions
RESTART IDENTITY CASCADE;

INSERT INTO calendar_exceptions (exception_date, type, name, description)
VALUES
  ('2025-01-01', 'holiday', 'Tahun Baru', 'Libur nasional tahun baru'),
  ('2025-03-31', 'holiday', 'Contoh Libur Nasional', 'Contoh hari libur manual'),
  ('2025-02-01', 'working_day', 'Contoh Hari Masuk Pengganti', 'Contoh Sabtu masuk kerja');

DO $$
DECLARE
  hr_department_id INTEGER;
  it_department_id INTEGER;
  management_department_id INTEGER;
  holding_location_id INTEGER;
  rey_user_id INTEGER;
  ardi_user_id INTEGER;
  fandra_user_id INTEGER;
  olin_user_id INTEGER;
  hr_user_id INTEGER;
  project_id_value INTEGER;
  bucket_planning_id INTEGER;
  bucket_work_id INTEGER;
  bucket_development_id INTEGER;
  bucket_testing_id INTEGER;
  bucket_deployment_id INTEGER;
  brd_task_id INTEGER;
  development_task_id INTEGER;
  side_menu_task_id INTEGER;
BEGIN
  INSERT INTO departments (name) VALUES ('HR') RETURNING id INTO hr_department_id;
  INSERT INTO departments (name) VALUES ('IT') RETURNING id INTO it_department_id;
  INSERT INTO departments (name) VALUES ('Management') RETURNING id INTO management_department_id;

  INSERT INTO locations (name) VALUES ('Holding') RETURNING id INTO holding_location_id;

  INSERT INTO users (name, email, role, password_hash, department_id, location_id)
  VALUES (
    'Super Admin',
    'superadmin@project-management.local',
    'super_admin',
    'sha256:3d7bcc373a2ca97559179ca882c81d369aa5a01525fb8a15bc8f79e11e71fe4a',
    NULL,
    holding_location_id
  );

  INSERT INTO users (name, email, role, department_id, location_id)
  VALUES ('Rey', 'rey@example.com', 'admin', it_department_id, holding_location_id)
  RETURNING id INTO rey_user_id;

  INSERT INTO users (name, email, role, department_id, location_id)
  VALUES ('Ardi', 'ardi@example.com', 'admin', it_department_id, holding_location_id)
  RETURNING id INTO ardi_user_id;

  INSERT INTO users (name, email, role, department_id, location_id)
  VALUES ('Fandra', 'fandra@example.com', 'admin', it_department_id, holding_location_id)
  RETURNING id INTO fandra_user_id;

  INSERT INTO users (name, email, role, department_id, location_id)
  VALUES ('Olin', 'olin@example.com', 'admin', it_department_id, holding_location_id)
  RETURNING id INTO olin_user_id;

  INSERT INTO users (name, email, role, department_id, location_id)
  VALUES ('HR', 'hr@example.com', 'admin', hr_department_id, holding_location_id)
  RETURNING id INTO hr_user_id;

  INSERT INTO projects (name, description, owner_id, start_date, end_date, status, progress)
  VALUES (
    'Timeline E-KPI',
    'Project implementation timeline for E-KPI system.',
    rey_user_id,
    '2024-09-20',
    '2025-07-29',
    'Active',
    99
  )
  RETURNING id INTO project_id_value;

  INSERT INTO project_members (project_id, user_id, role)
  VALUES
    (project_id_value, rey_user_id, 'owner'),
    (project_id_value, ardi_user_id, 'developer'),
    (project_id_value, fandra_user_id, 'designer'),
    (project_id_value, olin_user_id, 'designer'),
    (project_id_value, hr_user_id, 'stakeholder')
  ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  INSERT INTO buckets (project_id, name, sort_order)
  VALUES (project_id_value, 'Perencanaan', 1)
  RETURNING id INTO bucket_planning_id;

  INSERT INTO buckets (project_id, name, sort_order)
  VALUES (project_id_value, 'Pekerjaan', 2)
  RETURNING id INTO bucket_work_id;

  INSERT INTO buckets (project_id, name, sort_order)
  VALUES (project_id_value, 'Development App e-KPI', 3)
  RETURNING id INTO bucket_development_id;

  INSERT INTO buckets (project_id, name, sort_order)
  VALUES (project_id_value, 'Testing', 4)
  RETURNING id INTO bucket_testing_id;

  INSERT INTO buckets (project_id, name, sort_order)
  VALUES (project_id_value, 'Deployment', 5)
  RETURNING id INTO bucket_deployment_id;

  INSERT INTO tasks (project_id, bucket_id, title, assignee_id, lead_name, start_date, end_date, duration_days, work_days, progress, status, priority, sort_order)
  VALUES (project_id_value, bucket_planning_id, 'Meeting dengan HRD terkait cleansing data', rey_user_id, 'Rey', '2024-09-20', '2024-09-20', calculate_duration_days_sql('2024-09-20', '2024-09-20'), calculate_work_days_sql('2024-09-20', '2024-09-20'), 100, 'Done', 'Medium', 1);

  INSERT INTO tasks (project_id, bucket_id, title, assignee_id, lead_name, start_date, end_date, duration_days, work_days, progress, status, priority, sort_order)
  VALUES (project_id_value, bucket_planning_id, 'Cleansing data HR', hr_user_id, 'HR', '2024-09-23', '2024-10-21', calculate_duration_days_sql('2024-09-23', '2024-10-21'), calculate_work_days_sql('2024-09-23', '2024-10-21'), 100, 'Done', 'Medium', 2);

  INSERT INTO tasks (project_id, bucket_id, title, assignee_id, lead_name, start_date, end_date, duration_days, work_days, progress, status, priority, sort_order)
  VALUES (project_id_value, bucket_planning_id, 'Template untuk Reporting', hr_user_id, 'HR', '2024-10-22', '2024-10-28', calculate_duration_days_sql('2024-10-22', '2024-10-28'), calculate_work_days_sql('2024-10-22', '2024-10-28'), 100, 'Done', 'Medium', 3);

  INSERT INTO tasks (project_id, bucket_id, title, assignee_id, lead_name, start_date, end_date, duration_days, work_days, progress, status, priority, sort_order)
  VALUES (project_id_value, bucket_planning_id, 'Formula yang akan digunakan', hr_user_id, 'HR', '2024-10-14', '2024-10-18', calculate_duration_days_sql('2024-10-14', '2024-10-18'), calculate_work_days_sql('2024-10-14', '2024-10-18'), 100, 'Done', 'Medium', 4);

  INSERT INTO tasks (project_id, bucket_id, title, assignee_id, lead_name, start_date, end_date, duration_days, work_days, progress, status, priority, sort_order)
  VALUES (project_id_value, bucket_planning_id, 'Revisi Konsep Sistem e-KPI', rey_user_id, 'Rey', '2024-10-29', '2024-11-04', calculate_duration_days_sql('2024-10-29', '2024-11-04'), calculate_work_days_sql('2024-10-29', '2024-11-04'), 100, 'Done', 'Medium', 5);

  INSERT INTO tasks (project_id, bucket_id, title, assignee_id, lead_name, start_date, end_date, duration_days, work_days, progress, status, priority, sort_order)
  VALUES (project_id_value, bucket_planning_id, 'Presentasi mockup sistem e-KPI ke BOD', hr_user_id, 'HR', '2024-11-12', '2024-11-18', calculate_duration_days_sql('2024-11-12', '2024-11-18'), calculate_work_days_sql('2024-11-12', '2024-11-18'), 100, 'Done', 'Medium', 6);

  INSERT INTO tasks (project_id, bucket_id, title, assignee_id, lead_name, start_date, end_date, duration_days, work_days, progress, status, priority, sort_order)
  VALUES (project_id_value, bucket_work_id, 'Pembuatan BRD e-KPI', rey_user_id, 'Rey', '2024-11-19', '2024-12-18', calculate_duration_days_sql('2024-11-19', '2024-12-18'), calculate_work_days_sql('2024-11-19', '2024-12-18'), 100, 'Done', 'High', 7)
  RETURNING id INTO brd_task_id;

  INSERT INTO tasks (project_id, bucket_id, parent_task_id, title, assignee_id, lead_name, start_date, end_date, duration_days, work_days, progress, status, priority, sort_order)
  VALUES (project_id_value, bucket_work_id, brd_task_id, 'Pembuatan Flow e-KPI', rey_user_id, 'Rey', '2024-11-19', '2024-11-22', calculate_duration_days_sql('2024-11-19', '2024-11-22'), calculate_work_days_sql('2024-11-19', '2024-11-22'), 100, 'Done', 'Medium', 8);

  INSERT INTO tasks (project_id, bucket_id, parent_task_id, title, assignee_id, lead_name, start_date, end_date, duration_days, work_days, progress, status, priority, sort_order)
  VALUES (project_id_value, bucket_work_id, brd_task_id, 'Pembuatan Use-Case E-KPI', rey_user_id, 'Rey', '2024-11-25', '2024-11-29', calculate_duration_days_sql('2024-11-25', '2024-11-29'), calculate_work_days_sql('2024-11-25', '2024-11-29'), 100, 'Done', 'Medium', 9);

  INSERT INTO tasks (project_id, bucket_id, parent_task_id, title, assignee_id, lead_name, start_date, end_date, duration_days, work_days, progress, status, priority, sort_order)
  VALUES (project_id_value, bucket_work_id, brd_task_id, 'Revisi Mock-Up Lowfi Sistem E-KPI', rey_user_id, 'Rey', '2024-12-02', '2024-12-09', calculate_duration_days_sql('2024-12-02', '2024-12-09'), calculate_work_days_sql('2024-12-02', '2024-12-09'), 100, 'Done', 'Medium', 10);

  INSERT INTO tasks (project_id, bucket_id, title, assignee_id, lead_name, start_date, end_date, duration_days, work_days, progress, status, priority, sort_order)
  VALUES (project_id_value, bucket_work_id, 'Revisi Mockup Hifi Sistem E-KPI Master', fandra_user_id, 'Fandra', '2024-12-09', '2024-12-23', calculate_duration_days_sql('2024-12-09', '2024-12-23'), calculate_work_days_sql('2024-12-09', '2024-12-23'), 100, 'Done', 'Medium', 11);

  INSERT INTO tasks (project_id, bucket_id, title, assignee_id, lead_name, start_date, end_date, duration_days, work_days, progress, status, priority, sort_order)
  VALUES (project_id_value, bucket_work_id, 'Revisi Mockup Hifi Sistem E-KPI Transactional', olin_user_id, 'Olin', '2024-12-23', '2025-01-06', calculate_duration_days_sql('2024-12-23', '2025-01-06'), calculate_work_days_sql('2024-12-23', '2025-01-06'), 100, 'Done', 'Medium', 12);

  INSERT INTO tasks (project_id, bucket_id, title, assignee_id, lead_name, start_date, end_date, duration_days, work_days, progress, status, priority, sort_order)
  VALUES (project_id_value, bucket_work_id, 'Approval Dokumen BRD', rey_user_id, 'Rey', '2025-01-06', '2025-01-08', calculate_duration_days_sql('2025-01-06', '2025-01-08'), calculate_work_days_sql('2025-01-06', '2025-01-08'), 100, 'Done', 'High', 13);

  INSERT INTO tasks (project_id, bucket_id, title, assignee_id, lead_name, start_date, end_date, duration_days, work_days, progress, status, priority, sort_order)
  VALUES (project_id_value, bucket_development_id, 'Development App e-KPI', ardi_user_id, 'Ardi', '2025-01-08', '2025-03-31', calculate_duration_days_sql('2025-01-08', '2025-03-31'), calculate_work_days_sql('2025-01-08', '2025-03-31'), 94, 'In Progress', 'Urgent', 14)
  RETURNING id INTO development_task_id;

  INSERT INTO tasks (project_id, bucket_id, parent_task_id, title, assignee_id, lead_name, start_date, end_date, duration_days, work_days, progress, status, priority, sort_order)
  VALUES (project_id_value, bucket_development_id, development_task_id, 'Development Login Page', ardi_user_id, 'Ardi', '2025-01-08', '2025-01-20', calculate_duration_days_sql('2025-01-08', '2025-01-20'), calculate_work_days_sql('2025-01-08', '2025-01-20'), 100, 'Done', 'High', 15);

  INSERT INTO tasks (project_id, bucket_id, parent_task_id, title, assignee_id, lead_name, start_date, end_date, duration_days, work_days, progress, status, priority, sort_order)
  VALUES (project_id_value, bucket_development_id, development_task_id, 'Development & Consume API Login Page', ardi_user_id, 'Ardi', '2025-01-20', '2025-02-03', calculate_duration_days_sql('2025-01-20', '2025-02-03'), calculate_work_days_sql('2025-01-20', '2025-02-03'), 100, 'Done', 'High', 16);

  INSERT INTO tasks (project_id, bucket_id, parent_task_id, title, assignee_id, lead_name, start_date, end_date, duration_days, work_days, progress, status, priority, sort_order)
  VALUES (project_id_value, bucket_development_id, development_task_id, 'Development Side Menu', ardi_user_id, 'Ardi', '2025-02-03', '2025-03-31', calculate_duration_days_sql('2025-02-03', '2025-03-31'), calculate_work_days_sql('2025-02-03', '2025-03-31'), 83, 'In Progress', 'High', 17)
  RETURNING id INTO side_menu_task_id;

  INSERT INTO tasks (project_id, bucket_id, parent_task_id, title, assignee_id, lead_name, start_date, end_date, duration_days, work_days, progress, status, priority, sort_order)
  VALUES (project_id_value, bucket_development_id, side_menu_task_id, 'Development Menu Master', ardi_user_id, 'Ardi', '2025-02-03', '2025-02-14', calculate_duration_days_sql('2025-02-03', '2025-02-14'), calculate_work_days_sql('2025-02-03', '2025-02-14'), 100, 'Done', 'High', 18);

  INSERT INTO tasks (project_id, bucket_id, parent_task_id, title, assignee_id, lead_name, start_date, end_date, duration_days, work_days, progress, status, priority, sort_order)
  VALUES (project_id_value, bucket_development_id, side_menu_task_id, 'Development Menu Penilaian', ardi_user_id, 'Ardi', '2025-02-14', '2025-02-21', calculate_duration_days_sql('2025-02-14', '2025-02-21'), calculate_work_days_sql('2025-02-14', '2025-02-21'), 100, 'Done', 'High', 19);

  INSERT INTO tasks (project_id, bucket_id, parent_task_id, title, assignee_id, lead_name, start_date, end_date, duration_days, work_days, progress, status, priority, sort_order)
  VALUES (project_id_value, bucket_development_id, side_menu_task_id, 'Development & Consume API Menu Master', ardi_user_id, 'Ardi', '2025-02-21', '2025-02-28', calculate_duration_days_sql('2025-02-21', '2025-02-28'), calculate_work_days_sql('2025-02-21', '2025-02-28'), 100, 'Done', 'High', 20);

  INSERT INTO tasks (project_id, bucket_id, parent_task_id, title, assignee_id, lead_name, start_date, end_date, duration_days, work_days, progress, status, priority, sort_order)
  VALUES (project_id_value, bucket_development_id, side_menu_task_id, 'Development & Consume API Menu Penilaian', ardi_user_id, 'Ardi', '2025-02-28', '2025-03-07', calculate_duration_days_sql('2025-02-28', '2025-03-07'), calculate_work_days_sql('2025-02-28', '2025-03-07'), 100, 'Done', 'High', 21);

  INSERT INTO tasks (project_id, bucket_id, parent_task_id, title, assignee_id, lead_name, start_date, end_date, duration_days, work_days, progress, status, priority, sort_order)
  VALUES (project_id_value, bucket_development_id, side_menu_task_id, 'Development Menu Report', ardi_user_id, 'Ardi', '2025-03-07', '2025-03-14', calculate_duration_days_sql('2025-03-07', '2025-03-14'), calculate_work_days_sql('2025-03-07', '2025-03-14'), 100, 'Done', 'High', 22);

  INSERT INTO tasks (project_id, bucket_id, parent_task_id, title, assignee_id, lead_name, start_date, end_date, duration_days, work_days, progress, status, priority, sort_order)
  VALUES (project_id_value, bucket_development_id, side_menu_task_id, 'Development Dashboard', ardi_user_id, 'Ardi', '2025-03-14', '2025-03-21', calculate_duration_days_sql('2025-03-14', '2025-03-21'), calculate_work_days_sql('2025-03-14', '2025-03-21'), 0, 'In Progress', 'High', 23);

  UPDATE projects
  SET progress = (
    SELECT COALESCE(ROUND(AVG(progress))::INTEGER, 0)
    FROM tasks
    WHERE project_id = project_id_value AND parent_task_id IS NULL
  )
  WHERE id = project_id_value;

  INSERT INTO activity_logs (user_id, project_id, action, description)
  VALUES (rey_user_id, project_id_value, 'seed_created', 'Seed data Timeline E-KPI dibuat.');
END;
$$;

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
