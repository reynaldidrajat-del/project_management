const { query } = require('../config/db');
const { logActivity } = require('./activityService');

// Sprint states
const SPRINT_STATES = {
  FUTURE: 'FUTURE',
  ACTIVE: 'ACTIVE',
  CLOSED: 'CLOSED',
};

/**
 * Get all sprints for a project, optionally filtered by state
 * @param {number} projectId - Project ID
 * @param {string|null} state - Optional state filter (FUTURE, ACTIVE, CLOSED)
 * @returns {Promise<Array>} Array of sprints
 */
const getSprints = async (projectId, state = null) => {
  const conditions = ['s.project_id = $1'];
  const values = [projectId];

  if (state) {
    values.push(state);
    conditions.push(`s.state = $${values.length}`);
  }

  const whereClause = conditions.join(' AND ');

  const result = await query(
    `
    SELECT 
      s.id,
      s.project_id,
      s.name,
      s.goal,
      s.start_date,
      s.end_date,
      s.state,
      s.completed_at,
      s.created_at,
      s.updated_at,
      (SELECT COUNT(*)::INTEGER FROM tasks WHERE sprint_id = s.id) AS issue_count,
      (SELECT COUNT(*)::INTEGER FROM tasks t 
       INNER JOIN workflow_states ws ON ws.id = t.workflow_state_id 
       WHERE t.sprint_id = s.id AND ws.is_final = true) AS completed_issue_count,
      (SELECT COALESCE(SUM(story_points), 0)::INTEGER FROM tasks WHERE sprint_id = s.id) AS total_story_points,
      (SELECT COALESCE(SUM(t.story_points), 0)::INTEGER FROM tasks t 
       INNER JOIN workflow_states ws ON ws.id = t.workflow_state_id 
       WHERE t.sprint_id = s.id AND ws.is_final = true) AS completed_story_points
    FROM sprints s
    WHERE ${whereClause}
    ORDER BY 
      CASE s.state 
        WHEN 'ACTIVE' THEN 0 
        WHEN 'FUTURE' THEN 1 
        WHEN 'CLOSED' THEN 2 
      END,
      s.start_date ASC NULLS LAST,
      s.created_at DESC
    `,
    values
  );

  return result.rows;
};

/**
 * Get a single sprint by ID
 * @param {number} id - Sprint ID
 * @returns {Promise<Object|null>} Sprint object or null
 */
const getSprintById = async (id) => {
  const result = await query(
    `
    SELECT 
      s.id,
      s.project_id,
      s.name,
      s.goal,
      s.start_date,
      s.end_date,
      s.state,
      s.completed_at,
      s.created_at,
      s.updated_at,
      (SELECT COUNT(*)::INTEGER FROM tasks WHERE sprint_id = s.id) AS issue_count,
      (SELECT COUNT(*)::INTEGER FROM tasks t 
       INNER JOIN workflow_states ws ON ws.id = t.workflow_state_id 
       WHERE t.sprint_id = s.id AND ws.is_final = true) AS completed_issue_count,
      (SELECT COALESCE(SUM(story_points), 0)::INTEGER FROM tasks WHERE sprint_id = s.id) AS total_story_points,
      (SELECT COALESCE(SUM(t.story_points), 0)::INTEGER FROM tasks t 
       INNER JOIN workflow_states ws ON ws.id = t.workflow_state_id 
       WHERE t.sprint_id = s.id AND ws.is_final = true) AS completed_story_points
    FROM sprints s
    WHERE s.id = $1
    `,
    [id]
  );

  return result.rows[0] || null;
};

/**
 * Get the active sprint for a project (or null if none)
 * @param {number} projectId - Project ID
 * @returns {Promise<Object|null>} Active sprint or null
 */
const getActiveSprint = async (projectId) => {
  const result = await query(
    `
    SELECT 
      s.id,
      s.project_id,
      s.name,
      s.goal,
      s.start_date,
      s.end_date,
      s.state,
      s.completed_at,
      s.created_at,
      s.updated_at,
      (SELECT COUNT(*)::INTEGER FROM tasks WHERE sprint_id = s.id) AS issue_count,
      (SELECT COUNT(*)::INTEGER FROM tasks t 
       INNER JOIN workflow_states ws ON ws.id = t.workflow_state_id 
       WHERE t.sprint_id = s.id AND ws.is_final = true) AS completed_issue_count,
      (SELECT COALESCE(SUM(story_points), 0)::INTEGER FROM tasks WHERE sprint_id = s.id) AS total_story_points,
      (SELECT COALESCE(SUM(t.story_points), 0)::INTEGER FROM tasks t 
       INNER JOIN workflow_states ws ON ws.id = t.workflow_state_id 
       WHERE t.sprint_id = s.id AND ws.is_final = true) AS completed_story_points
    FROM sprints s
    WHERE s.project_id = $1 AND s.state = 'ACTIVE'
    LIMIT 1
    `,
    [projectId]
  );

  return result.rows[0] || null;
};

/**
 * Create a new sprint
 * Validates that start_date precedes end_date (Req 3.2)
 * @param {Object} data - Sprint data
 * @param {Object} context - Activity context
 * @returns {Promise<Object>} Created sprint
 */
const createSprint = async (data, context = {}) => {
  const { project_id, name, goal = null, start_date = null, end_date = null } = data;

  if (!project_id) {
    throw new Error('Project ID is required.');
  }

  if (!name || !name.trim()) {
    throw new Error('Sprint name is required.');
  }

  // Validate start_date precedes end_date (Req 3.2)
  if (start_date && end_date) {
    const startDateObj = new Date(start_date);
    const endDateObj = new Date(end_date);
    if (startDateObj >= endDateObj) {
      throw new Error('Start date must precede end date.');
    }
  }

  const result = await query(
    `
    INSERT INTO sprints (project_id, name, goal, start_date, end_date, state)
    VALUES ($1, $2, $3, $4, $5, 'FUTURE')
    RETURNING *
    `,
    [project_id, name.trim(), goal, start_date || null, end_date || null]
  );

  const sprint = result.rows[0];

  await logActivity({
    actor_user_id: context.actor_user_id || null,
    project_id: project_id,
    action: 'sprint.create',
    object_type: 'sprint',
    object_id: sprint.id,
    description: `Sprint "${sprint.name}" created.`,
    metadata: { name: sprint.name, goal, start_date, end_date },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  return sprint;
};

/**
 * Update a sprint
 * Prevents date modifications on ACTIVE sprints (Req 3.4)
 * @param {number} id - Sprint ID
 * @param {Object} data - Updated data
 * @param {Object} context - Activity context
 * @returns {Promise<Object>} Updated sprint
 */
const updateSprint = async (id, data, context = {}) => {
  const sprint = await getSprintById(id);

  if (!sprint) {
    throw new Error('Sprint not found.');
  }

  // Prevent date modifications on ACTIVE sprints (Req 3.4)
  if (sprint.state === SPRINT_STATES.ACTIVE) {
    if (data.start_date !== undefined || data.end_date !== undefined) {
      throw new Error('Cannot modify dates on an active sprint.');
    }
  }

  // Prevent modifications on CLOSED sprints
  if (sprint.state === SPRINT_STATES.CLOSED) {
    throw new Error('Cannot modify a closed sprint.');
  }

  const { name, goal, start_date, end_date } = data;

  // Validate dates if both are provided or being updated
  const effectiveStartDate = start_date !== undefined ? start_date : sprint.start_date;
  const effectiveEndDate = end_date !== undefined ? end_date : sprint.end_date;

  if (effectiveStartDate && effectiveEndDate) {
    const startDateObj = new Date(effectiveStartDate);
    const endDateObj = new Date(effectiveEndDate);
    if (startDateObj >= endDateObj) {
      throw new Error('Start date must precede end date.');
    }
  }

  const result = await query(
    `
    UPDATE sprints
    SET 
      name = COALESCE($1, name),
      goal = COALESCE($2, goal),
      start_date = COALESCE($3, start_date),
      end_date = COALESCE($4, end_date),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $5
    RETURNING *
    `,
    [
      name !== undefined ? name.trim() : null,
      goal !== undefined ? goal : null,
      start_date !== undefined ? start_date : null,
      end_date !== undefined ? end_date : null,
      id,
    ]
  );

  const updatedSprint = result.rows[0];

  await logActivity({
    actor_user_id: context.actor_user_id || null,
    project_id: sprint.project_id,
    action: 'sprint.update',
    object_type: 'sprint',
    object_id: id,
    description: `Sprint "${updatedSprint.name}" updated.`,
    metadata: { changes: data },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  return updatedSprint;
};

/**
 * Delete a sprint (only FUTURE sprints can be deleted)
 * @param {number} id - Sprint ID
 * @param {Object} context - Activity context
 * @returns {Promise<void>}
 */
const deleteSprint = async (id, context = {}) => {
  const sprint = await getSprintById(id);

  if (!sprint) {
    throw new Error('Sprint not found.');
  }

  // Only FUTURE sprints can be deleted
  if (sprint.state !== SPRINT_STATES.FUTURE) {
    throw new Error('Only future sprints can be deleted. Active or closed sprints cannot be removed.');
  }

  // Unassign any issues from this sprint before deleting
  await query(
    'UPDATE tasks SET sprint_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE sprint_id = $1',
    [id]
  );

  await query('DELETE FROM sprints WHERE id = $1', [id]);

  await logActivity({
    actor_user_id: context.actor_user_id || null,
    project_id: sprint.project_id,
    action: 'sprint.delete',
    object_type: 'sprint',
    object_id: id,
    description: `Sprint "${sprint.name}" deleted.`,
    metadata: { name: sprint.name },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });
};

/**
 * Start a sprint: transition FUTURE → ACTIVE
 * Validates only one active sprint per project (Req 3.5)
 * @param {number} id - Sprint ID
 * @param {Object} context - Activity context
 * @returns {Promise<Object>} Updated sprint
 */
const startSprint = async (id, context = {}) => {
  const sprint = await getSprintById(id);

  if (!sprint) {
    throw new Error('Sprint not found.');
  }

  // Only FUTURE sprints can be started
  if (sprint.state !== SPRINT_STATES.FUTURE) {
    throw new Error('Only future sprints can be started.');
  }

  // Validate start_date and end_date are set
  if (!sprint.start_date || !sprint.end_date) {
    throw new Error('Sprint must have both start date and end date before starting.');
  }

  // Validate only one active sprint per project (Req 3.5)
  const activeSprint = await getActiveSprint(sprint.project_id);
  if (activeSprint) {
    throw new Error(`Cannot start sprint. Project already has an active sprint: "${activeSprint.name}".`);
  }

  const result = await query(
    `
    UPDATE sprints
    SET state = 'ACTIVE', updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *
    `,
    [id]
  );

  const updatedSprint = result.rows[0];

  await logActivity({
    actor_user_id: context.actor_user_id || null,
    project_id: sprint.project_id,
    action: 'sprint.start',
    object_type: 'sprint',
    object_id: id,
    description: `Sprint "${updatedSprint.name}" started.`,
    metadata: { start_date: sprint.start_date, end_date: sprint.end_date },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  return updatedSprint;
};

/**
 * Complete a sprint: transition ACTIVE → CLOSED
 * Handles incomplete issues by moving them to backlog or next sprint (Req 3.6)
 * @param {number} id - Sprint ID
 * @param {Object} options - Completion options
 * @param {number|null} options.moveToSprintId - Sprint ID to move incomplete issues to (null = backlog)
 * @param {Object} context - Activity context
 * @returns {Promise<Object>} Updated sprint
 */
const completeSprint = async (id, options = {}, context = {}) => {
  const sprint = await getSprintById(id);

  if (!sprint) {
    throw new Error('Sprint not found.');
  }

  // Only ACTIVE sprints can be completed
  if (sprint.state !== SPRINT_STATES.ACTIVE) {
    throw new Error('Only active sprints can be completed.');
  }

  const { moveToSprintId = null } = options;

  // If moveToSprintId is specified, validate it exists and belongs to same project
  if (moveToSprintId) {
    const targetSprint = await getSprintById(moveToSprintId);
    if (!targetSprint) {
      throw new Error('Target sprint not found.');
    }
    if (targetSprint.project_id !== sprint.project_id) {
      throw new Error('Target sprint must belong to the same project.');
    }
    if (targetSprint.state === SPRINT_STATES.CLOSED) {
      throw new Error('Cannot move issues to a closed sprint.');
    }
  }

  // Find incomplete issues (issues not in a final workflow state)
  const incompleteIssuesResult = await query(
    `
    SELECT t.id FROM tasks t
    LEFT JOIN workflow_states ws ON ws.id = t.workflow_state_id
    WHERE t.sprint_id = $1 
      AND (ws.is_final IS NULL OR ws.is_final = false)
    `,
    [id]
  );

  const incompleteIssueIds = incompleteIssuesResult.rows.map(row => row.id);

  // Move incomplete issues to target sprint or backlog (sprint_id = NULL)
  if (incompleteIssueIds.length > 0) {
    await query(
      `
      UPDATE tasks 
      SET sprint_id = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = ANY($2::INTEGER[])
      `,
      [moveToSprintId, incompleteIssueIds]
    );
  }

  // Mark sprint as CLOSED
  const result = await query(
    `
    UPDATE sprints
    SET state = 'CLOSED', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *
    `,
    [id]
  );

  const updatedSprint = result.rows[0];

  await logActivity({
    actor_user_id: context.actor_user_id || null,
    project_id: sprint.project_id,
    action: 'sprint.complete',
    object_type: 'sprint',
    object_id: id,
    description: `Sprint "${updatedSprint.name}" completed.`,
    metadata: {
      incomplete_issues_count: incompleteIssueIds.length,
      moved_to_sprint_id: moveToSprintId,
      moved_to: moveToSprintId ? 'next_sprint' : 'backlog',
    },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  return updatedSprint;
};

module.exports = {
  SPRINT_STATES,
  completeSprint,
  createSprint,
  deleteSprint,
  getActiveSprint,
  getSprintById,
  getSprints,
  startSprint,
  updateSprint,
};
