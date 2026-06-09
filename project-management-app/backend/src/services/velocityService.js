const { query } = require('../config/db');
const { logActivity } = require('./activityService');

const DEFAULT_LIMIT = 10;

const normalizePositiveInteger = (value, fieldName = 'ID') => {
  const normalizedValue = Number(value);

  if (!Number.isInteger(normalizedValue) || normalizedValue <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }

  return normalizedValue;
};

const normalizeLimit = (value) => {
  const normalizedValue = Number(value || DEFAULT_LIMIT);
  return Number.isInteger(normalizedValue) && normalizedValue > 0 ? Math.min(normalizedValue, 50) : DEFAULT_LIMIT;
};

const getSprintVelocity = async (sprintId) => {
  const normalizedSprintId = normalizePositiveInteger(sprintId, 'Sprint ID');
  const result = await query(
    `
    SELECT
      s.id AS sprint_id,
      s.project_id,
      s.name AS sprint_name,
      s.start_date AS sprint_started_at,
      s.completed_at AS sprint_completed_at,
      s.state,
      COUNT(t.id)::INTEGER AS committed_issue_count,
      COUNT(t.id) FILTER (WHERE t.status = 'Done' OR COALESCE(ws.is_final, FALSE))::INTEGER AS completed_issue_count,
      COALESCE(SUM(COALESCE(t.story_points, 0)), 0)::INTEGER AS committed_story_points,
      COALESCE(SUM(CASE WHEN t.status = 'Done' OR COALESCE(ws.is_final, FALSE) THEN COALESCE(t.story_points, 0) ELSE 0 END), 0)::INTEGER AS completed_story_points
    FROM sprints s
    LEFT JOIN tasks t ON t.sprint_id = s.id
    LEFT JOIN workflow_states ws ON ws.id = t.workflow_state_id
    WHERE s.id = $1
    GROUP BY s.id
    `,
    [normalizedSprintId],
  );

  const sprint = result.rows[0];

  if (!sprint) {
    throw new Error('Sprint not found.');
  }

  return {
    ...sprint,
    scope_change_story_points: 0,
    velocity: Number(sprint.completed_story_points || 0),
  };
};

const upsertSprintVelocityHistory = async (sprintId, context = {}) => {
  const velocity = await getSprintVelocity(sprintId);

  const result = await query(
    `
    INSERT INTO velocity_history (
      project_id,
      sprint_id,
      committed_story_points,
      completed_story_points,
      committed_issue_count,
      completed_issue_count,
      scope_change_story_points,
      sprint_started_at,
      sprint_completed_at,
      calculated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
    ON CONFLICT (sprint_id)
    DO UPDATE SET
      project_id = EXCLUDED.project_id,
      committed_story_points = EXCLUDED.committed_story_points,
      completed_story_points = EXCLUDED.completed_story_points,
      committed_issue_count = EXCLUDED.committed_issue_count,
      completed_issue_count = EXCLUDED.completed_issue_count,
      scope_change_story_points = EXCLUDED.scope_change_story_points,
      sprint_started_at = EXCLUDED.sprint_started_at,
      sprint_completed_at = EXCLUDED.sprint_completed_at,
      calculated_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
    `,
    [
      velocity.project_id,
      velocity.sprint_id,
      velocity.committed_story_points,
      velocity.completed_story_points,
      velocity.committed_issue_count,
      velocity.completed_issue_count,
      velocity.scope_change_story_points,
      velocity.sprint_started_at,
      velocity.sprint_completed_at,
    ],
  );

  const history = result.rows[0];

  if (!context.log_silent) {
    await logActivity({
      actor_user_id: context.actor_user_id || null,
      project_id: history.project_id,
      action: 'velocity_history.upsert',
      object_type: 'velocity_history',
      object_id: history.id,
      description: `Velocity history updated for sprint ${history.sprint_id}.`,
      metadata: {
        completed_story_points: history.completed_story_points,
        sprint_id: history.sprint_id,
      },
      ip_address: context.ip_address,
      user_agent: context.user_agent,
    });
  }

  return history;
};

const syncClosedSprintVelocityHistory = async (projectId, context = {}) => {
  const normalizedProjectId = normalizePositiveInteger(projectId, 'Project ID');
  const sprintResult = await query(
    `
    SELECT id
    FROM sprints
    WHERE project_id = $1
      AND state = 'CLOSED'
    ORDER BY completed_at DESC NULLS LAST, end_date DESC NULLS LAST, id DESC
    `,
    [normalizedProjectId],
  );

  const histories = [];

  for (const sprint of sprintResult.rows) {
    histories.push(await upsertSprintVelocityHistory(sprint.id, context));
  }

  return histories;
};

const listVelocityHistory = async (projectId, options = {}) => {
  const normalizedProjectId = normalizePositiveInteger(projectId, 'Project ID');
  await syncClosedSprintVelocityHistory(normalizedProjectId, { log_silent: true });

  const result = await query(
    `
    SELECT
      vh.id,
      vh.project_id,
      vh.sprint_id,
      s.name AS sprint_name,
      vh.committed_story_points,
      vh.completed_story_points,
      vh.committed_issue_count,
      vh.completed_issue_count,
      vh.scope_change_story_points,
      vh.sprint_started_at,
      vh.sprint_completed_at,
      vh.calculated_at
    FROM velocity_history vh
    INNER JOIN sprints s ON s.id = vh.sprint_id
    WHERE vh.project_id = $1
    ORDER BY vh.sprint_completed_at DESC NULLS LAST, vh.id DESC
    LIMIT $2
    `,
    [normalizedProjectId, normalizeLimit(options.limit)],
  );

  return result.rows;
};

const averageVelocity = (history, count) => {
  const selected = history.slice(0, count);

  if (!selected.length) {
    return 0;
  }

  const total = selected.reduce((sum, item) => sum + Number(item.completed_story_points || 0), 0);
  return Math.round((total / selected.length) * 100) / 100;
};

const getVelocitySummary = async (projectId, options = {}) => {
  const history = await listVelocityHistory(projectId, {
    limit: Math.max(10, normalizeLimit(options.limit)),
  });
  const averages = {
    last_3_sprints: averageVelocity(history, 3),
    last_5_sprints: averageVelocity(history, 5),
    last_10_sprints: averageVelocity(history, 10),
  };
  const recommendedCapacity = Math.max(0, Math.floor((averages.last_3_sprints || averages.last_5_sprints || averages.last_10_sprints) * 0.85));

  return {
    averages,
    history,
    project_id: Number(projectId),
    recommendation: {
      basis: averages.last_3_sprints > 0 ? 'last_3_sprints' : averages.last_5_sprints > 0 ? 'last_5_sprints' : 'last_10_sprints',
      recommended_story_points: recommendedCapacity,
      safety_factor: 0.85,
    },
  };
};

module.exports = {
  getSprintVelocity,
  getVelocitySummary,
  listVelocityHistory,
  syncClosedSprintVelocityHistory,
  upsertSprintVelocityHistory,
};
