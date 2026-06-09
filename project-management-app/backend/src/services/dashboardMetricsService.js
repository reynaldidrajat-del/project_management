const { query } = require('../config/db');
const { emitToProject, emitToUser } = require('./realtimeService');

const DEFAULT_AGING_THRESHOLD_DAYS = 7;

const normalizePositiveInteger = (value, fieldName = 'ID') => {
  const normalizedValue = Number(value);

  if (!Number.isInteger(normalizedValue) || normalizedValue <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }

  return normalizedValue;
};

const getOptionalProjectCondition = (filters = {}, values = [], alias = 't') => {
  if (!filters.project_id && !filters.projectId) {
    return '';
  }

  values.push(normalizePositiveInteger(filters.project_id || filters.projectId, 'Project ID'));
  return ` AND ${alias}.project_id = $${values.length}`;
};

const getCycleLeadTimeMetrics = async (filters = {}) => {
  const values = [];
  const projectCondition = getOptionalProjectCondition(filters, values);

  const result = await query(
    `
    WITH completed AS (
      SELECT
        t.id,
        GREATEST(0, EXTRACT(DAY FROM (COALESCE(t.completed_at, t.updated_at) - COALESCE(t.actual_start_date::TIMESTAMP, t.start_date::TIMESTAMP, t.created_at)))::INTEGER) AS cycle_time_days,
        GREATEST(0, EXTRACT(DAY FROM (COALESCE(t.completed_at, t.updated_at) - t.created_at))::INTEGER) AS lead_time_days
      FROM tasks t
      LEFT JOIN workflow_states ws ON ws.id = t.workflow_state_id
      WHERE (t.status = 'Done' OR COALESCE(ws.is_final, FALSE))
        AND t.deleted_at IS NULL
        ${projectCondition}
    )
    SELECT
      COUNT(*)::INTEGER AS completed_issue_count,
      COALESCE(ROUND(AVG(cycle_time_days), 2), 0)::FLOAT AS average_cycle_time_days,
      COALESCE(ROUND(AVG(lead_time_days), 2), 0)::FLOAT AS average_lead_time_days,
      COALESCE(MAX(cycle_time_days), 0)::INTEGER AS max_cycle_time_days,
      COALESCE(MAX(lead_time_days), 0)::INTEGER AS max_lead_time_days
    FROM completed
    `,
    values,
  );

  const distributionResult = await query(
    `
    WITH completed AS (
      SELECT
        GREATEST(0, EXTRACT(DAY FROM (COALESCE(t.completed_at, t.updated_at) - COALESCE(t.actual_start_date::TIMESTAMP, t.start_date::TIMESTAMP, t.created_at)))::INTEGER) AS cycle_time_days,
        GREATEST(0, EXTRACT(DAY FROM (COALESCE(t.completed_at, t.updated_at) - t.created_at))::INTEGER) AS lead_time_days
      FROM tasks t
      LEFT JOIN workflow_states ws ON ws.id = t.workflow_state_id
      WHERE (t.status = 'Done' OR COALESCE(ws.is_final, FALSE))
        AND t.deleted_at IS NULL
        ${projectCondition}
    )
    SELECT
      CASE
        WHEN cycle_time_days <= 1 THEN '0-1'
        WHEN cycle_time_days <= 3 THEN '2-3'
        WHEN cycle_time_days <= 7 THEN '4-7'
        WHEN cycle_time_days <= 14 THEN '8-14'
        ELSE '15+'
      END AS bucket,
      COUNT(*)::INTEGER AS issue_count
    FROM completed
    GROUP BY bucket
    ORDER BY MIN(cycle_time_days)
    `,
    values,
  );

  return {
    ...result.rows[0],
    cycle_time_distribution: distributionResult.rows,
  };
};

const getIssueAgingReport = async (filters = {}) => {
  const values = [];
  const projectCondition = getOptionalProjectCondition(filters, values);
  const thresholdDays = Number(filters.threshold_days || filters.thresholdDays || DEFAULT_AGING_THRESHOLD_DAYS);
  values.push(Number.isFinite(thresholdDays) && thresholdDays > 0 ? thresholdDays : DEFAULT_AGING_THRESHOLD_DAYS);
  const thresholdParam = `$${values.length}`;

  const result = await query(
    `
    SELECT
      t.id,
      t.issue_key,
      t.title,
      t.project_id,
      p.name AS project_name,
      t.status,
      t.priority,
      t.assignee_id,
      assignee.name AS assignee_name,
      GREATEST(0, EXTRACT(DAY FROM (CURRENT_TIMESTAMP - COALESCE(t.actual_start_date::TIMESTAMP, t.start_date::TIMESTAMP, t.updated_at, t.created_at)))::INTEGER) AS age_days
    FROM tasks t
    INNER JOIN projects p ON p.id = t.project_id
    LEFT JOIN users assignee ON assignee.id = t.assignee_id
    WHERE t.deleted_at IS NULL
      AND t.status IN ('In Progress', 'Waiting Review', 'Overdue')
      ${projectCondition}
      AND GREATEST(0, EXTRACT(DAY FROM (CURRENT_TIMESTAMP - COALESCE(t.actual_start_date::TIMESTAMP, t.start_date::TIMESTAMP, t.updated_at, t.created_at)))::INTEGER) >= ${thresholdParam}
    ORDER BY age_days DESC, t.priority DESC, t.updated_at ASC
    `,
    values,
  );

  return {
    threshold_days: Number(values[values.length - 1]),
    issues: result.rows,
  };
};

const getWorkloadDistribution = async (filters = {}) => {
  const values = [];
  const projectCondition = getOptionalProjectCondition(filters, values);

  const result = await query(
    `
    WITH assignee_links AS (
      SELECT DISTINCT t.id AS task_id, ta.user_id
      FROM tasks t
      INNER JOIN task_assignees ta ON ta.task_id = t.id
      WHERE t.deleted_at IS NULL
        ${projectCondition}
      UNION
      SELECT DISTINCT t.id AS task_id, t.assignee_id AS user_id
      FROM tasks t
      WHERE t.deleted_at IS NULL
        AND t.assignee_id IS NOT NULL
        ${projectCondition}
    )
    SELECT
      u.id AS user_id,
      u.name AS user_name,
      COUNT(t.id)::INTEGER AS issue_count,
      COUNT(t.id) FILTER (WHERE t.status NOT IN ('Done'))::INTEGER AS open_issue_count,
      COALESCE(SUM(COALESCE(t.story_points, 0)), 0)::INTEGER AS story_points,
      COALESCE(SUM(CASE WHEN t.status <> 'Done' THEN COALESCE(t.story_points, 0) ELSE 0 END), 0)::INTEGER AS open_story_points
    FROM assignee_links al
    INNER JOIN users u ON u.id = al.user_id
    INNER JOIN tasks t ON t.id = al.task_id
    GROUP BY u.id, u.name
    ORDER BY open_story_points DESC, open_issue_count DESC, u.name ASC
    `,
    values,
  );

  return result.rows;
};

const getSprintHealthIndicators = async (filters = {}) => {
  if (!filters.project_id && !filters.projectId) {
    return [];
  }

  const projectId = normalizePositiveInteger(filters.project_id || filters.projectId, 'Project ID');
  const result = await query(
    `
    SELECT
      s.id AS sprint_id,
      s.name AS sprint_name,
      s.state,
      s.start_date,
      s.end_date,
      COUNT(t.id)::INTEGER AS issue_count,
      COUNT(t.id) FILTER (WHERE t.status = 'Done' OR COALESCE(ws.is_final, FALSE))::INTEGER AS completed_issue_count,
      COALESCE(SUM(COALESCE(t.story_points, 0)), 0)::INTEGER AS total_story_points,
      COALESCE(SUM(CASE WHEN t.status = 'Done' OR COALESCE(ws.is_final, FALSE) THEN COALESCE(t.story_points, 0) ELSE 0 END), 0)::INTEGER AS completed_story_points
    FROM sprints s
    LEFT JOIN tasks t ON t.sprint_id = s.id
    LEFT JOIN workflow_states ws ON ws.id = t.workflow_state_id
    WHERE s.project_id = $1
      AND s.state IN ('ACTIVE', 'FUTURE')
    GROUP BY s.id
    ORDER BY CASE s.state WHEN 'ACTIVE' THEN 0 ELSE 1 END, s.start_date ASC NULLS LAST
    `,
    [projectId],
  );

  return result.rows.map((sprint) => {
    const total = Number(sprint.total_story_points || 0) || Number(sprint.issue_count || 0);
    const completed = Number(sprint.completed_story_points || 0) || Number(sprint.completed_issue_count || 0);
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    const daysRemaining = sprint.end_date
      ? Math.ceil((new Date(`${sprint.end_date}T00:00:00`).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      : null;

    return {
      ...sprint,
      days_remaining: daysRemaining,
      health: sprint.state === 'ACTIVE' && daysRemaining !== null && daysRemaining <= 2 && progress < 80 ? 'at_risk' : 'on_track',
      progress,
    };
  });
};

const getDashboardMetrics = async (filters = {}) => {
  const [cycleLeadTime, issueAging, workload, sprintHealth] = await Promise.all([
    getCycleLeadTimeMetrics(filters),
    getIssueAgingReport(filters),
    getWorkloadDistribution(filters),
    getSprintHealthIndicators(filters),
  ]);

  return {
    cycle_lead_time: cycleLeadTime,
    issue_aging: issueAging,
    sprint_health: sprintHealth,
    workload_distribution: workload,
  };
};

const getDashboardPreference = async (userId, projectId = null) => {
  const normalizedUserId = normalizePositiveInteger(userId, 'User ID');
  const normalizedProjectId = projectId ? normalizePositiveInteger(projectId, 'Project ID') : null;
  const result = await query(
    `
    SELECT id, user_id, project_id, layout, widgets, created_at, updated_at
    FROM dashboard_preferences
    WHERE user_id = $1
      AND (
        ($2::INTEGER IS NULL AND project_id IS NULL)
        OR project_id = $2
      )
    `,
    [normalizedUserId, normalizedProjectId],
  );

  return result.rows[0] || {
    layout: [],
    project_id: normalizedProjectId,
    user_id: normalizedUserId,
    widgets: [],
  };
};

const updateDashboardPreference = async (userId, payload = {}) => {
  const normalizedUserId = normalizePositiveInteger(userId, 'User ID');
  const normalizedProjectId = payload.project_id || payload.projectId
    ? normalizePositiveInteger(payload.project_id || payload.projectId, 'Project ID')
    : null;
  const existing = await getDashboardPreference(normalizedUserId, normalizedProjectId);

  if (existing.id) {
    const result = await query(
      `
      UPDATE dashboard_preferences
      SET layout = $1::JSONB,
          widgets = $2::JSONB,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
      RETURNING id, user_id, project_id, layout, widgets, created_at, updated_at
      `,
      [JSON.stringify(payload.layout || []), JSON.stringify(payload.widgets || []), existing.id],
    );

    const preference = result.rows[0];
    emitDashboardMetricsUpdated(normalizedProjectId, {
      event: 'dashboard.preference.updated',
      user_id: normalizedUserId,
    });

    return preference;
  }

  const result = await query(
    `
    INSERT INTO dashboard_preferences (user_id, project_id, layout, widgets)
    VALUES ($1, $2, $3::JSONB, $4::JSONB)
    RETURNING id, user_id, project_id, layout, widgets, created_at, updated_at
    `,
    [
      normalizedUserId,
      normalizedProjectId,
      JSON.stringify(payload.layout || []),
      JSON.stringify(payload.widgets || []),
    ],
  );

  const preference = result.rows[0];
  emitDashboardMetricsUpdated(normalizedProjectId, {
    event: 'dashboard.preference.updated',
    user_id: normalizedUserId,
  });

  return preference;
};

const emitDashboardMetricsUpdated = (projectId, metadata = {}) => {
  if (projectId) {
    emitToProject(projectId, 'dashboard.metrics.updated', {
      metadata,
      project_id: Number(projectId),
    });
    return;
  }

  if (metadata.user_id) {
    emitToUser(metadata.user_id, 'dashboard.metrics.updated', { metadata });
  }
};

module.exports = {
  emitDashboardMetricsUpdated,
  getCycleLeadTimeMetrics,
  getDashboardMetrics,
  getDashboardPreference,
  getIssueAgingReport,
  getSprintHealthIndicators,
  getWorkloadDistribution,
  updateDashboardPreference,
};
