const { query } = require('../config/db');
const { getTasks } = require('./taskService');

// Mengambil task dalam bentuk tree agar mudah digambar sebagai Gantt chart.
const getAllGanttTasks = async (filters = {}) => {
  return getTasks({
    ...filters,
    tree: true,
  });
};

// Mengambil Gantt hanya untuk satu project.
const getProjectGanttTasks = async (projectId) => {
  return getAllGanttTasks({ project_id: projectId });
};

const getDepartmentLocationCondition = (alias, locationParam) => {
  return locationParam ? `AND ${alias}.location_id = ${locationParam}` : '';
};

// Mengambil ringkasan department, user, project, dan task untuk Gantt department.
const getDepartmentGanttTasks = async (departmentId, filters = {}) => {
  const values = [departmentId];
  let locationParam = '';

  if (filters.location_id) {
    values.push(filters.location_id);
    locationParam = `$${values.length}`;
  }

  const [departmentResult, locationResult, usersResult, projectsResult, tasks] = await Promise.all([
    query('SELECT id, name FROM departments WHERE id = $1', [departmentId]),
    locationParam ? query('SELECT id, name FROM locations WHERE id = $1', [filters.location_id]) : Promise.resolve({ rows: [] }),
    query(
      `
        WITH user_project_involvement AS (
          SELECT user_id, project_id, SUM(task_count)::INTEGER AS task_count
          FROM (
            SELECT ta.user_id, t.project_id, COUNT(DISTINCT t.id)::INTEGER AS task_count
            FROM task_assignees ta
            INNER JOIN tasks t ON t.id = ta.task_id
            GROUP BY ta.user_id, t.project_id
            UNION ALL
            SELECT t.assignee_id AS user_id, t.project_id, COUNT(*)::INTEGER AS task_count
            FROM tasks t
            WHERE t.assignee_id IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id)
            GROUP BY t.assignee_id, t.project_id
            UNION ALL
            SELECT user_id, project_id, 0 AS task_count
            FROM project_members
          ) involvement_source
          GROUP BY user_id, project_id
        )
        SELECT
          u.id,
          u.name,
          u.email,
          u.role,
          u.department_id,
          d.name AS department_name,
          u.location_id,
          l.name AS location_name,
          COALESCE(SUM(user_project_involvement.task_count), 0)::INTEGER AS task_count,
          COUNT(DISTINCT user_project_involvement.project_id)::INTEGER AS project_count,
          COALESCE(
            json_agg(
              DISTINCT jsonb_build_object(
                'id', p.id,
                'name', p.name,
                'status', p.status,
                'progress', p.progress
              )
            ) FILTER (WHERE p.id IS NOT NULL),
            '[]'::JSON
          ) AS projects
        FROM users u
        INNER JOIN departments d ON d.id = u.department_id
        LEFT JOIN locations l ON l.id = u.location_id
        LEFT JOIN user_project_involvement ON user_project_involvement.user_id = u.id
        LEFT JOIN projects p ON p.id = user_project_involvement.project_id
        WHERE u.department_id = $1
          ${getDepartmentLocationCondition('u', locationParam)}
        GROUP BY u.id, u.name, u.email, u.role, u.department_id, d.name, u.location_id, l.name
        ORDER BY u.name
      `,
      values,
    ),
    query(
      `
        WITH involvement AS (
          SELECT pm.project_id, pm.user_id
          FROM project_members pm
          INNER JOIN users member_user ON member_user.id = pm.user_id
          WHERE member_user.department_id = $1
            ${getDepartmentLocationCondition('member_user', locationParam)}
          UNION
          SELECT t.project_id, ta.user_id
          FROM tasks t
          INNER JOIN task_assignees ta ON ta.task_id = t.id
          INNER JOIN users task_user ON task_user.id = ta.user_id
          WHERE task_user.department_id = $1
            ${getDepartmentLocationCondition('task_user', locationParam)}
          UNION
          SELECT t.project_id, t.assignee_id AS user_id
          FROM tasks t
          INNER JOIN users task_user ON task_user.id = t.assignee_id
          WHERE task_user.department_id = $1
            ${getDepartmentLocationCondition('task_user', locationParam)}
        )
        SELECT
          p.id,
          p.name,
          p.status,
          p.progress,
          to_char(p.start_date, 'YYYY-MM-DD') AS start_date,
          to_char(p.end_date, 'YYYY-MM-DD') AS end_date,
          COUNT(DISTINCT involvement.user_id)::INTEGER AS department_user_count,
          COUNT(DISTINCT t.id) FILTER (
            WHERE
              EXISTS (
                SELECT 1
                FROM task_assignees task_assignee
                INNER JOIN users task_user ON task_user.id = task_assignee.user_id
                WHERE task_assignee.task_id = t.id
                  AND task_user.department_id = $1
                  ${getDepartmentLocationCondition('task_user', locationParam)}
              )
              OR EXISTS (
                SELECT 1
                FROM users legacy_task_user
                WHERE legacy_task_user.id = t.assignee_id
                  AND legacy_task_user.department_id = $1
                  ${getDepartmentLocationCondition('legacy_task_user', locationParam)}
              )
          )::INTEGER AS department_task_count
        FROM involvement
        INNER JOIN projects p ON p.id = involvement.project_id
        LEFT JOIN tasks t ON t.project_id = p.id
        GROUP BY p.id, p.name, p.status, p.progress, p.start_date, p.end_date
        ORDER BY p.start_date NULLS LAST, p.name
      `,
      values,
    ),
    getAllGanttTasks({ department_id: departmentId, location_id: filters.location_id }),
  ]);

  return {
    department: departmentResult.rows[0] || null,
    location: locationResult.rows[0] || null,
    users: usersResult.rows,
    projects: projectsResult.rows,
    tasks,
  };
};

module.exports = {
  getAllGanttTasks,
  getDepartmentGanttTasks,
  getProjectGanttTasks,
};
