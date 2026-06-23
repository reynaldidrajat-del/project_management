const { query } = require('../config/db');
const { appendProjectVisibilityCondition } = require('./projectAccessService');

const buildProjectVisibilityScope = (user, options = {}) => {
  const conditions = [];
  const values = [];

  appendProjectVisibilityCondition(conditions, values, user, options);

  return {
    values,
    whereClause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
  };
};

// Mengumpulkan banyak ringkasan sekaligus untuk isi dashboard utama.
const getDashboardSummary = async (context = {}) => {
  const projectSummaryScope = buildProjectVisibilityScope(context.user);
  const taskSummaryScope = buildProjectVisibilityScope(context.user, { projectIdExpression: 't.project_id' });
  const averageProgressScope = buildProjectVisibilityScope(context.user);
  const tasksDueThisWeekScope = buildProjectVisibilityScope(context.user, { projectIdExpression: 't.project_id' });
  const projectsByDepartmentScope = buildProjectVisibilityScope(context.user);
  const tasksByStatusScope = buildProjectVisibilityScope(context.user, { projectIdExpression: 't.project_id' });
  const overdueByDepartmentScope = buildProjectVisibilityScope(context.user);

  const [
    projectSummary,
    taskSummary,
    averageProgress,
    tasksDueThisWeek,
    projectsByDepartment,
    tasksByStatus,
    overdueByDepartment,
  ] = await Promise.all([
    query(`
      SELECT
        COUNT(*)::INTEGER AS total_projects,
        COUNT(*) FILTER (WHERE p.status = 'Active')::INTEGER AS active_projects,
        COUNT(*) FILTER (WHERE p.status = 'Completed')::INTEGER AS completed_projects
      FROM projects p
      ${projectSummaryScope.whereClause}
    `, projectSummaryScope.values),
    query(`
      WITH task_status AS (
        SELECT
          CASE
            WHEN t.end_date < CURRENT_DATE AND t.progress < 100 AND t.status NOT IN ('Done', 'Waiting Review') THEN 'Overdue'
            ELSE t.status
          END AS effective_status
        FROM tasks t
        INNER JOIN projects p ON p.id = t.project_id
        ${taskSummaryScope.whereClause}
      )
      SELECT
        COUNT(*)::INTEGER AS total_tasks,
        COUNT(*) FILTER (WHERE effective_status = 'Not Started')::INTEGER AS not_started_tasks,
        COUNT(*) FILTER (WHERE effective_status = 'In Progress')::INTEGER AS in_progress_tasks,
        COUNT(*) FILTER (WHERE effective_status = 'Waiting Review')::INTEGER AS waiting_review_tasks,
        COUNT(*) FILTER (WHERE effective_status = 'Done')::INTEGER AS done_tasks,
        COUNT(*) FILTER (WHERE effective_status = 'Overdue')::INTEGER AS overdue_tasks
      FROM task_status
    `, taskSummaryScope.values),
    query(`
      SELECT COALESCE(ROUND(AVG(p.progress))::INTEGER, 0) AS average_progress
      FROM projects p
      ${averageProgressScope.whereClause}
    `, averageProgressScope.values),
    query(`
      SELECT COUNT(*)::INTEGER AS tasks_due_this_week
      FROM tasks t
      INNER JOIN projects p ON p.id = t.project_id
      ${tasksDueThisWeekScope.whereClause}
      ${tasksDueThisWeekScope.whereClause ? 'AND' : 'WHERE'} t.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
    `, tasksDueThisWeekScope.values),
    query(`
      WITH involvement AS (
        SELECT member_user.department_id, pm.project_id
        FROM project_members pm
        INNER JOIN users member_user ON member_user.id = pm.user_id
        WHERE member_user.department_id IS NOT NULL
        UNION
        SELECT task_user.department_id, t.project_id
        FROM tasks t
        INNER JOIN task_assignees ta ON ta.task_id = t.id
        INNER JOIN users task_user ON task_user.id = ta.user_id
        WHERE task_user.department_id IS NOT NULL
        UNION
        SELECT task_user.department_id, t.project_id
        FROM tasks t
        INNER JOIN users task_user ON task_user.id = t.assignee_id
        WHERE task_user.department_id IS NOT NULL
      ),
      visible_involvement AS (
        SELECT involvement.*
        FROM involvement
        INNER JOIN projects p ON p.id = involvement.project_id
        ${projectsByDepartmentScope.whereClause}
      )
      SELECT
        d.id AS department_id,
        d.name AS department_name,
        COUNT(DISTINCT visible_involvement.project_id)::INTEGER AS total_projects
      FROM departments d
      LEFT JOIN visible_involvement ON visible_involvement.department_id = d.id
      GROUP BY d.id, d.name
      ORDER BY d.name
    `, projectsByDepartmentScope.values),
    query(`
      WITH task_status AS (
        SELECT
          CASE
            WHEN t.end_date < CURRENT_DATE AND t.progress < 100 AND t.status NOT IN ('Done', 'Waiting Review') THEN 'Overdue'
            ELSE t.status
          END AS status
        FROM tasks t
        INNER JOIN projects p ON p.id = t.project_id
        ${tasksByStatusScope.whereClause}
      )
      SELECT status, COUNT(*)::INTEGER AS total
      FROM task_status
      GROUP BY status
      ORDER BY status
    `, tasksByStatusScope.values),
    query(`
      WITH overdue_tasks_raw AS (
        SELECT DISTINCT task_user.department_id, t.id AS task_id, t.project_id
        FROM tasks t
        INNER JOIN task_assignees ta ON ta.task_id = t.id
        INNER JOIN users task_user ON task_user.id = ta.user_id
        WHERE t.end_date < CURRENT_DATE
          AND t.progress < 100
          AND t.status NOT IN ('Done', 'Waiting Review')
          AND task_user.department_id IS NOT NULL
        UNION
        SELECT DISTINCT legacy_task_user.department_id, t.id AS task_id, t.project_id
        FROM tasks t
        INNER JOIN users legacy_task_user ON legacy_task_user.id = t.assignee_id
        WHERE t.end_date < CURRENT_DATE
          AND t.progress < 100
          AND t.status NOT IN ('Done', 'Waiting Review')
          AND legacy_task_user.department_id IS NOT NULL
      ),
      overdue_tasks AS (
        SELECT overdue_tasks_raw.*
        FROM overdue_tasks_raw
        INNER JOIN projects p ON p.id = overdue_tasks_raw.project_id
        ${overdueByDepartmentScope.whereClause}
      )
      SELECT
        d.id AS department_id,
        d.name AS department_name,
        COUNT(DISTINCT overdue_tasks.task_id)::INTEGER AS overdue_tasks
      FROM departments d
      LEFT JOIN overdue_tasks ON overdue_tasks.department_id = d.id
      GROUP BY d.id, d.name
      ORDER BY d.name
    `, overdueByDepartmentScope.values),
  ]);

  return {
    ...projectSummary.rows[0],
    ...taskSummary.rows[0],
    average_progress: Number(averageProgress.rows[0]?.average_progress || 0),
    tasks_due_this_week: Number(tasksDueThisWeek.rows[0]?.tasks_due_this_week || 0),
    projects_by_department: projectsByDepartment.rows,
    tasks_by_status: tasksByStatus.rows,
    overdue_by_department: overdueByDepartment.rows,
  };
};

module.exports = {
  getDashboardSummary,
};
