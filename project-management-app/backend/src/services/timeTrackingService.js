const { query } = require('../config/db');
const { logActivity } = require('./activityService');
const { triggerAutomation } = require('./automationService');
const { notifyIssueWatchers } = require('./watcherService');

const HOURS_PER_DAY = Number(process.env.TIME_TRACKING_HOURS_PER_DAY || 8);

const TIME_LOG_SELECT = `
  SELECT
    tl.id,
    tl.issue_id,
    t.title AS issue_title,
    t.issue_key,
    t.project_id,
    p.name AS project_name,
    tl.user_id,
    u.name AS user_name,
    u.email AS user_email,
    tl.time_spent_minutes,
    ROUND(tl.time_spent_minutes::NUMERIC / 60, 2)::FLOAT AS time_spent_hours,
    to_char(tl.work_date, 'YYYY-MM-DD') AS work_date,
    tl.description,
    tl.remaining_estimate_minutes,
    ROUND(tl.remaining_estimate_minutes::NUMERIC / 60, 2)::FLOAT AS remaining_estimate_hours,
    tl.created_at,
    tl.updated_at
  FROM time_logs tl
  INNER JOIN tasks t ON t.id = tl.issue_id
  INNER JOIN projects p ON p.id = t.project_id
  INNER JOIN users u ON u.id = tl.user_id
`;

const normalizePositiveInteger = (value, fieldName) => {
  const normalizedValue = Number(value);

  if (!Number.isInteger(normalizedValue) || normalizedValue < 0) {
    throw new Error(`${fieldName} must be a non-negative integer.`);
  }

  return normalizedValue;
};

const normalizeId = (value, fieldName) => {
  const normalizedValue = Number(value);

  if (!Number.isInteger(normalizedValue) || normalizedValue <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }

  return normalizedValue;
};

const normalizeDurationMinutes = (payload = {}, fieldPrefix = 'time_spent') => {
  const minutesKey = `${fieldPrefix}_minutes`;
  const hoursKey = `${fieldPrefix}_hours`;
  const daysKey = `${fieldPrefix}_days`;

  if (payload[minutesKey] !== undefined) {
    return normalizePositiveInteger(payload[minutesKey], `${fieldPrefix}_minutes`);
  }

  if (payload[hoursKey] !== undefined) {
    const hours = Number(payload[hoursKey]);

    if (!Number.isFinite(hours) || hours < 0) {
      throw new Error(`${fieldPrefix}_hours must be a non-negative number.`);
    }

    return Math.round(hours * 60);
  }

  if (payload[daysKey] !== undefined) {
    const days = Number(payload[daysKey]);

    if (!Number.isFinite(days) || days < 0) {
      throw new Error(`${fieldPrefix}_days must be a non-negative number.`);
    }

    return Math.round(days * HOURS_PER_DAY * 60);
  }

  if (payload.value !== undefined && payload.unit) {
    const value = Number(payload.value);

    if (!Number.isFinite(value) || value < 0) {
      throw new Error('Duration value must be a non-negative number.');
    }

    if (payload.unit === 'minutes') {
      return Math.round(value);
    }

    if (payload.unit === 'hours') {
      return Math.round(value * 60);
    }

    if (payload.unit === 'days') {
      return Math.round(value * HOURS_PER_DAY * 60);
    }
  }

  throw new Error(`${fieldPrefix}_minutes, ${fieldPrefix}_hours, or ${fieldPrefix}_days is required.`);
};

const getIssueTimeTracking = async (issueId) => {
  const result = await query(
    `
    SELECT
      t.id AS issue_id,
      t.title AS issue_title,
      t.issue_key,
      t.project_id,
      t.original_estimate_minutes,
      ROUND(COALESCE(t.original_estimate_minutes, 0)::NUMERIC / 60, 2)::FLOAT AS original_estimate_hours,
      t.remaining_estimate_minutes,
      ROUND(COALESCE(t.remaining_estimate_minutes, 0)::NUMERIC / 60, 2)::FLOAT AS remaining_estimate_hours,
      COALESCE(SUM(tl.time_spent_minutes), 0)::INTEGER AS time_spent_minutes,
      ROUND(COALESCE(SUM(tl.time_spent_minutes), 0)::NUMERIC / 60, 2)::FLOAT AS time_spent_hours
    FROM tasks t
    LEFT JOIN time_logs tl ON tl.issue_id = t.id
    WHERE t.id = $1
    GROUP BY t.id
    `,
    [issueId],
  );

  if (!result.rows[0]) {
    throw new Error('Issue not found.');
  }

  return result.rows[0];
};

const notifyTimeTrackingUpdate = async (issueId, payload = {}, context = {}) => {
  try {
    await notifyIssueWatchers(issueId, {
      actor_user_id: context.actor_user_id || context.user_id || null,
      body: payload.body || null,
      metadata: payload.metadata || {},
      title: payload.title || 'Issue time tracking updated',
      type: payload.type || 'issue.updated',
    }, {
      exclude_user_ids: [context.actor_user_id || context.user_id || null],
    });
  } catch (error) {
    console.error(`Watcher notification failed for time tracking update: ${error.message}`);
  }

  try {
    await triggerAutomation('issue_updated', issueId, {
      changed_fields: payload.changed_fields || ['time_tracking'],
      issue_id: issueId,
    }, context);
  } catch (error) {
    console.error(`Automation trigger failed for time tracking update: ${error.message}`);
  }
};

const updateIssueEstimates = async (issueId, payload = {}, context = {}) => {
  const normalizedIssueId = normalizeId(issueId, 'Issue ID');
  const current = await getIssueTimeTracking(normalizedIssueId);

  const originalEstimateMinutes = payload.original_estimate_minutes !== undefined ||
    payload.original_estimate_hours !== undefined ||
    payload.original_estimate_days !== undefined
    ? normalizeDurationMinutes(payload, 'original_estimate')
    : current.original_estimate_minutes || 0;

  const remainingEstimateMinutes = payload.remaining_estimate_minutes !== undefined ||
    payload.remaining_estimate_hours !== undefined ||
    payload.remaining_estimate_days !== undefined
    ? normalizeDurationMinutes(payload, 'remaining_estimate')
    : current.remaining_estimate_minutes || 0;

  await query(
    `
    UPDATE tasks
    SET original_estimate_minutes = $1,
        remaining_estimate_minutes = $2,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $3
    `,
    [originalEstimateMinutes, remainingEstimateMinutes, normalizedIssueId],
  );

  const updated = await getIssueTimeTracking(normalizedIssueId);

  await logActivity({
    actor_user_id: context.actor_user_id || null,
    task_id: normalizedIssueId,
    project_id: updated.project_id,
    action: 'time_tracking.estimates.update',
    object_type: 'issue',
    object_id: normalizedIssueId,
    description: `Time estimates updated for issue "${updated.issue_key || updated.issue_title}".`,
    metadata: {
      original_estimate_minutes: originalEstimateMinutes,
      remaining_estimate_minutes: remainingEstimateMinutes,
    },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  await notifyTimeTrackingUpdate(normalizedIssueId, {
    changed_fields: ['original_estimate_minutes', 'remaining_estimate_minutes'],
    metadata: {
      original_estimate_minutes: originalEstimateMinutes,
      remaining_estimate_minutes: remainingEstimateMinutes,
    },
    title: `Time estimates updated: ${updated.issue_key || updated.issue_title}`,
  }, context);

  return updated;
};

const listWorkLogs = async (filters = {}) => {
  const conditions = [];
  const values = [];

  if (filters.issue_id || filters.issueId) {
    values.push(normalizeId(filters.issue_id || filters.issueId, 'Issue ID'));
    conditions.push(`tl.issue_id = $${values.length}`);
  }

  if (filters.project_id || filters.projectId) {
    values.push(normalizeId(filters.project_id || filters.projectId, 'Project ID'));
    conditions.push(`t.project_id = $${values.length}`);
  }

  if (filters.user_id || filters.userId) {
    values.push(normalizeId(filters.user_id || filters.userId, 'User ID'));
    conditions.push(`tl.user_id = $${values.length}`);
  }

  if (filters.date_from || filters.dateFrom) {
    values.push(filters.date_from || filters.dateFrom);
    conditions.push(`tl.work_date >= $${values.length}`);
  }

  if (filters.date_to || filters.dateTo) {
    values.push(filters.date_to || filters.dateTo);
    conditions.push(`tl.work_date <= $${values.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await query(
    `
    ${TIME_LOG_SELECT}
    ${whereClause}
    ORDER BY tl.work_date DESC, tl.created_at DESC, tl.id DESC
    `,
    values,
  );

  return result.rows;
};

const createWorkLog = async (issueId, payload = {}, context = {}) => {
  const normalizedIssueId = normalizeId(issueId, 'Issue ID');
  const userId = normalizeId(payload.user_id || context.actor_user_id, 'User ID');
  const timeSpentMinutes = normalizeDurationMinutes(payload, 'time_spent');
  const issue = await getIssueTimeTracking(normalizedIssueId);
  const workDate = payload.work_date || payload.workDate || new Date().toISOString().slice(0, 10);

  const remainingEstimateMinutes = payload.remaining_estimate_minutes !== undefined ||
    payload.remaining_estimate_hours !== undefined ||
    payload.remaining_estimate_days !== undefined
    ? normalizeDurationMinutes(payload, 'remaining_estimate')
    : Math.max(0, Number(issue.remaining_estimate_minutes || 0) - timeSpentMinutes);

  const result = await query(
    `
    INSERT INTO time_logs (
      issue_id,
      user_id,
      time_spent_minutes,
      work_date,
      description,
      remaining_estimate_minutes
    )
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id
    `,
    [
      normalizedIssueId,
      userId,
      timeSpentMinutes,
      workDate,
      payload.description || null,
      remainingEstimateMinutes,
    ],
  );

  await query(
    `
    UPDATE tasks
    SET remaining_estimate_minutes = $1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    `,
    [remainingEstimateMinutes, normalizedIssueId],
  );

  const workLog = await getWorkLogById(result.rows[0].id);

  await logActivity({
    actor_user_id: context.actor_user_id || userId,
    task_id: normalizedIssueId,
    project_id: issue.project_id,
    action: 'time_log.create',
    object_type: 'time_log',
    object_id: workLog.id,
    description: `Work logged on issue "${issue.issue_key || issue.issue_title}".`,
    metadata: {
      time_spent_minutes: timeSpentMinutes,
      remaining_estimate_minutes: remainingEstimateMinutes,
      work_date: workDate,
    },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  await notifyTimeTrackingUpdate(normalizedIssueId, {
    changed_fields: ['remaining_estimate_minutes', 'time_spent_minutes'],
    metadata: {
      time_spent_minutes: timeSpentMinutes,
      work_log_id: workLog.id,
    },
    title: `Work logged: ${issue.issue_key || issue.issue_title}`,
    type: 'time_log.create',
  }, context);

  return workLog;
};

const getWorkLogById = async (id) => {
  const result = await query(
    `
    ${TIME_LOG_SELECT}
    WHERE tl.id = $1
    `,
    [id],
  );

  return result.rows[0] || null;
};

const deleteWorkLog = async (id, context = {}) => {
  const workLog = await getWorkLogById(id);

  if (!workLog) {
    throw new Error('Work log not found.');
  }

  await query('DELETE FROM time_logs WHERE id = $1', [id]);

  const summary = await getIssueTimeTracking(workLog.issue_id);

  await logActivity({
    actor_user_id: context.actor_user_id || null,
    task_id: workLog.issue_id,
    project_id: workLog.project_id,
    action: 'time_log.delete',
    object_type: 'time_log',
    object_id: Number(id),
    description: `Work log deleted from issue "${workLog.issue_key || workLog.issue_title}".`,
    metadata: {
      deleted_time_spent_minutes: workLog.time_spent_minutes,
    },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  await notifyTimeTrackingUpdate(workLog.issue_id, {
    changed_fields: ['time_spent_minutes'],
    metadata: {
      deleted_work_log_id: Number(id),
      deleted_time_spent_minutes: workLog.time_spent_minutes,
    },
    title: `Work log deleted: ${workLog.issue_key || workLog.issue_title}`,
    type: 'time_log.delete',
  }, context);

  return {
    deleted_work_log_id: Number(id),
    issue_summary: summary,
  };
};

const getTimeTrackingReport = async (filters = {}) => {
  const conditions = [];
  const values = [];

  if (filters.project_id || filters.projectId) {
    values.push(normalizeId(filters.project_id || filters.projectId, 'Project ID'));
    conditions.push(`t.project_id = $${values.length}`);
  }

  if (filters.user_id || filters.userId) {
    values.push(normalizeId(filters.user_id || filters.userId, 'User ID'));
    conditions.push(`tl.user_id = $${values.length}`);
  }

  if (filters.sprint_id || filters.sprintId) {
    values.push(normalizeId(filters.sprint_id || filters.sprintId, 'Sprint ID'));
    conditions.push(`t.sprint_id = $${values.length}`);
  }

  if (filters.epic_id || filters.epicId) {
    values.push(normalizeId(filters.epic_id || filters.epicId, 'Epic ID'));
    conditions.push(`t.epic_id = $${values.length}`);
  }

  if (filters.date_from || filters.dateFrom) {
    values.push(filters.date_from || filters.dateFrom);
    conditions.push(`tl.work_date >= $${values.length}`);
  }

  if (filters.date_to || filters.dateTo) {
    values.push(filters.date_to || filters.dateTo);
    conditions.push(`tl.work_date <= $${values.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const [summaryResult, byUserResult, byIssueResult] = await Promise.all([
    query(
      `
      SELECT
        COALESCE(SUM(tl.time_spent_minutes), 0)::INTEGER AS total_time_spent_minutes,
        ROUND(COALESCE(SUM(tl.time_spent_minutes), 0)::NUMERIC / 60, 2)::FLOAT AS total_time_spent_hours,
        COUNT(tl.id)::INTEGER AS work_log_count
      FROM time_logs tl
      INNER JOIN tasks t ON t.id = tl.issue_id
      ${whereClause}
      `,
      values,
    ),
    query(
      `
      SELECT
        tl.user_id,
        u.name AS user_name,
        COALESCE(SUM(tl.time_spent_minutes), 0)::INTEGER AS time_spent_minutes,
        ROUND(COALESCE(SUM(tl.time_spent_minutes), 0)::NUMERIC / 60, 2)::FLOAT AS time_spent_hours
      FROM time_logs tl
      INNER JOIN tasks t ON t.id = tl.issue_id
      INNER JOIN users u ON u.id = tl.user_id
      ${whereClause}
      GROUP BY tl.user_id, u.name
      ORDER BY time_spent_minutes DESC
      `,
      values,
    ),
    query(
      `
      SELECT
        t.id AS issue_id,
        t.title AS issue_title,
        t.issue_key,
        COALESCE(SUM(tl.time_spent_minutes), 0)::INTEGER AS time_spent_minutes,
        ROUND(COALESCE(SUM(tl.time_spent_minutes), 0)::NUMERIC / 60, 2)::FLOAT AS time_spent_hours
      FROM time_logs tl
      INNER JOIN tasks t ON t.id = tl.issue_id
      ${whereClause}
      GROUP BY t.id
      ORDER BY time_spent_minutes DESC
      `,
      values,
    ),
  ]);

  return {
    summary: summaryResult.rows[0],
    by_user: byUserResult.rows,
    by_issue: byIssueResult.rows,
  };
};

module.exports = {
  HOURS_PER_DAY,
  createWorkLog,
  deleteWorkLog,
  getIssueTimeTracking,
  getTimeTrackingReport,
  getWorkLogById,
  listWorkLogs,
  normalizeDurationMinutes,
  updateIssueEstimates,
};
