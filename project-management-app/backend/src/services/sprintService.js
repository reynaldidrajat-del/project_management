const { query } = require('../config/db');
const { logActivity } = require('./activityService');
const { getCalendarExceptionMap } = require('./calendarService');
const { emitDashboardMetricsUpdated } = require('./dashboardMetricsService');
const { emitToProject, emitToProjectOrWorkspace, emitToTask } = require('./realtimeService');
const { eachDateInclusive, formatDateKey } = require('../utils/dateUtils');
const { calculateWorkDays, isWorkingDay } = require('../utils/workdayUtils');

// Sprint states
const SPRINT_STATES = {
  FUTURE: 'FUTURE',
  ACTIVE: 'ACTIVE',
  CLOSED: 'CLOSED',
};

const getActorUserId = (context = {}) => context.actor_user_id || context.user_id || null;

const emitSprintRealtimeEvent = (eventName, sprint, context = {}, metadata = {}) => {
  if (!sprint?.project_id) {
    return;
  }

  const payload = {
    actor_user_id: getActorUserId(context),
    event: eventName,
    metadata,
    project_id: Number(sprint.project_id),
    sprint,
    sprint_id: sprint.id ? Number(sprint.id) : null,
  };

  emitToProjectOrWorkspace(sprint.project_id, eventName, payload);
  emitToProjectOrWorkspace(sprint.project_id, 'sprint.changed', payload);
  emitDashboardMetricsUpdated(sprint.project_id, {
    event: eventName,
    sprint_id: sprint.id ? Number(sprint.id) : null,
  });
};

const emitSprintIssueTaskEvents = (sprint, issueIds = [], context = {}, metadata = {}) => {
  const projectId = sprint?.project_id ? Number(sprint.project_id) : null;

  if (!projectId) {
    return;
  }

  issueIds.forEach((issueId) => {
    const normalizedIssueId = Number(issueId);

    if (!Number.isInteger(normalizedIssueId) || normalizedIssueId <= 0) {
      return;
    }

    const payload = {
      actor_user_id: getActorUserId(context),
      event: 'task.updated',
      metadata,
      project_id: projectId,
      task_id: normalizedIssueId,
    };

    emitToProject(projectId, 'task.updated', payload);
    emitToTask(normalizedIssueId, 'task.updated', payload);
  });
};

const normalizeIssueIds = (issueIds) => {
  if (!Array.isArray(issueIds)) {
    throw new Error('Issue IDs must be provided as an array.');
  }

  const normalizedIds = issueIds
    .map((issueId) => Number(issueId))
    .filter((issueId) => Number.isInteger(issueId) && issueId > 0);

  const uniqueIds = [...new Set(normalizedIds)];

  if (uniqueIds.length === 0) {
    throw new Error('No valid issue IDs were provided.');
  }

  return uniqueIds;
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
 * Get issues assigned to a sprint.
 * @param {number} sprintId - Sprint ID
 * @returns {Promise<Array>} Assigned issues
 */
const getSprintIssues = async (sprintId) => {
  const sprint = await getSprintById(sprintId);

  if (!sprint) {
    throw new Error('Sprint not found.');
  }

  const result = await query(
    `
    SELECT
      t.id,
      t.title,
      t.description,
      t.status,
      t.priority,
      t.start_date,
      t.end_date,
      t.progress,
      t.issue_type_id,
      t.issue_key,
      t.story_points,
      t.epic_id,
      t.sprint_id,
      t.workflow_state_id,
      t.assignee_id,
      t.project_id,
      t.sort_order,
      it.name AS issue_type_name,
      it.icon AS issue_type_icon,
      it.color AS issue_type_color,
      e.epic_name,
      e.epic_color,
      u.name AS assignee_name,
      ws.name AS workflow_state_name,
      ws.category AS workflow_state_category,
      ws.color AS workflow_state_color,
      ws.is_final AS workflow_state_is_final
    FROM tasks t
    LEFT JOIN issue_types it ON it.id = t.issue_type_id
    LEFT JOIN epics e ON e.id = t.epic_id
    LEFT JOIN users u ON u.id = t.assignee_id
    LEFT JOIN workflow_states ws ON ws.id = t.workflow_state_id
    WHERE t.sprint_id = $1
    ORDER BY t.sort_order ASC, t.created_at DESC
    `,
    [sprintId]
  );

  return result.rows;
};

/**
 * Assign issues to a sprint.
 * @param {number} sprintId - Sprint ID
 * @param {number[]} issueIds - Issue IDs to assign
 * @param {Object} context - Activity context
 * @returns {Promise<Object>} Assignment result
 */
const addIssuesToSprint = async (sprintId, issueIds, context = {}) => {
  const sprint = await getSprintById(sprintId);

  if (!sprint) {
    throw new Error('Sprint not found.');
  }

  if (sprint.state === SPRINT_STATES.CLOSED) {
    throw new Error('Cannot add issues to a closed sprint.');
  }

  const normalizedIssueIds = normalizeIssueIds(issueIds);
  const issuesResult = await query(
    `
    SELECT id, project_id
    FROM tasks
    WHERE id = ANY($1::INTEGER[])
    `,
    [normalizedIssueIds]
  );

  if (issuesResult.rowCount !== normalizedIssueIds.length) {
    throw new Error('One or more issues were not found.');
  }

  const crossProjectIssue = issuesResult.rows.find((issue) => issue.project_id !== sprint.project_id);

  if (crossProjectIssue) {
    throw new Error('All issues must belong to the same project as the sprint.');
  }

  const result = await query(
    `
    UPDATE tasks
    SET sprint_id = $1,
        backlog_order = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ANY($2::INTEGER[])
      AND project_id = $3
    RETURNING id
    `,
    [sprintId, normalizedIssueIds, sprint.project_id]
  );

  const assignedIssueIds = result.rows.map((row) => row.id);

  await logActivity({
    actor_user_id: context.actor_user_id || null,
    project_id: sprint.project_id,
    action: 'sprint.issues.add',
    object_type: 'sprint',
    object_id: sprint.id,
    description: `${assignedIssueIds.length} issue(s) added to sprint "${sprint.name}".`,
    metadata: { issue_ids: assignedIssueIds },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  emitSprintRealtimeEvent('sprint.issues.added', sprint, context, {
    action: 'sprint.issues.add',
    issue_ids: assignedIssueIds,
  });
  emitSprintIssueTaskEvents(sprint, assignedIssueIds, context, {
    action: 'sprint.issues.add',
    sprint_id: Number(sprintId),
  });

  return {
    sprint_id: Number(sprintId),
    assigned_count: assignedIssueIds.length,
    issue_ids: assignedIssueIds,
  };
};

/**
 * Remove issues from a sprint and place them at the end of the backlog.
 * @param {number} sprintId - Sprint ID
 * @param {number[]} issueIds - Issue IDs to remove
 * @param {Object} context - Activity context
 * @returns {Promise<Object>} Removal result
 */
const removeIssuesFromSprint = async (sprintId, issueIds, context = {}) => {
  const sprint = await getSprintById(sprintId);

  if (!sprint) {
    throw new Error('Sprint not found.');
  }

  if (sprint.state === SPRINT_STATES.CLOSED) {
    throw new Error('Cannot remove issues from a closed sprint.');
  }

  const normalizedIssueIds = normalizeIssueIds(issueIds);
  const maxOrderResult = await query(
    `
    SELECT COALESCE(MAX(backlog_order), 0)::INTEGER AS max_order
    FROM tasks
    WHERE project_id = $1
      AND sprint_id IS NULL
    `,
    [sprint.project_id]
  );

  let nextBacklogOrder = maxOrderResult.rows[0].max_order + 1;
  const removedIssueIds = [];

  for (const issueId of normalizedIssueIds) {
    const result = await query(
      `
      UPDATE tasks
      SET sprint_id = NULL,
          backlog_order = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
        AND sprint_id = $3
        AND project_id = $4
      RETURNING id
      `,
      [nextBacklogOrder, issueId, sprintId, sprint.project_id]
    );

    if (result.rowCount > 0) {
      removedIssueIds.push(result.rows[0].id);
      nextBacklogOrder += 1;
    }
  }

  await logActivity({
    actor_user_id: context.actor_user_id || null,
    project_id: sprint.project_id,
    action: 'sprint.issues.remove',
    object_type: 'sprint',
    object_id: sprint.id,
    description: `${removedIssueIds.length} issue(s) removed from sprint "${sprint.name}".`,
    metadata: { issue_ids: removedIssueIds },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  emitSprintRealtimeEvent('sprint.issues.removed', sprint, context, {
    action: 'sprint.issues.remove',
    issue_ids: removedIssueIds,
  });
  emitSprintIssueTaskEvents(sprint, removedIssueIds, context, {
    action: 'sprint.issues.remove',
    sprint_id: Number(sprintId),
  });

  return {
    sprint_id: Number(sprintId),
    removed_count: removedIssueIds.length,
    issue_ids: removedIssueIds,
  };
};

/**
 * Get sprint metrics and burndown data.
 * @param {number} sprintId - Sprint ID
 * @returns {Promise<Object>} Sprint metrics
 */
const getSprintMetrics = async (sprintId) => {
  const sprint = await getSprintById(sprintId);

  if (!sprint) {
    throw new Error('Sprint not found.');
  }

  const issuesResult = await query(
    `
    SELECT
      t.id,
      COALESCE(t.story_points, 0)::INTEGER AS story_points,
      t.status,
      t.completed_at,
      t.updated_at,
      COALESCE(ws.is_final, false) AS is_final
    FROM tasks t
    LEFT JOIN workflow_states ws ON ws.id = t.workflow_state_id
    WHERE t.sprint_id = $1
    `,
    [sprintId]
  );

  const issues = issuesResult.rows;
  const totalIssues = issues.length;
  const completedIssues = issues.filter((issue) => issue.status === 'Done' || issue.is_final).length;
  const totalStoryPoints = issues.reduce((sum, issue) => sum + Number(issue.story_points || 0), 0);
  const completedStoryPoints = issues
    .filter((issue) => issue.status === 'Done' || issue.is_final)
    .reduce((sum, issue) => sum + Number(issue.story_points || 0), 0);

  const exceptionByDate = await getCalendarExceptionMap();
  const sprintStartDate = formatDateKey(sprint.start_date);
  const sprintEndDate = formatDateKey(sprint.end_date);
  const workingDays = sprintStartDate && sprintEndDate
    ? calculateWorkDays(sprintStartDate, sprintEndDate, exceptionByDate)
    : 0;

  const workingDates = sprintStartDate && sprintEndDate
    ? eachDateInclusive(sprintStartDate, sprintEndDate)
      .filter((date) => isWorkingDay(date, exceptionByDate))
      .map((date) => formatDateKey(date))
    : [];

  const burndownTotal = totalStoryPoints > 0 ? totalStoryPoints : totalIssues;
  const burndown = workingDates.map((dateKey, index) => {
    const dateEnd = new Date(`${dateKey}T23:59:59`);
    const completedByDate = issues
      .filter((issue) => issue.status === 'Done' || issue.is_final)
      .filter((issue) => {
        const completedAt = issue.completed_at || issue.updated_at;
        return completedAt ? new Date(completedAt) <= dateEnd : false;
      })
      .reduce((sum, issue) => sum + (totalStoryPoints > 0 ? Number(issue.story_points || 0) : 1), 0);
    const idealRemaining = workingDates.length <= 1
      ? 0
      : Math.max(0, Math.round(burndownTotal - ((burndownTotal / (workingDates.length - 1)) * index)));

    return {
      date: dateKey,
      ideal_remaining: idealRemaining,
      actual_remaining: Math.max(0, burndownTotal - completedByDate),
    };
  });

  return {
    sprint_id: Number(sprintId),
    total_issues: totalIssues,
    completed_issues: completedIssues,
    remaining_issues: totalIssues - completedIssues,
    total_story_points: totalStoryPoints,
    completed_story_points: completedStoryPoints,
    remaining_story_points: totalStoryPoints - completedStoryPoints,
    progress: totalStoryPoints > 0
      ? Math.round((completedStoryPoints / totalStoryPoints) * 100)
      : totalIssues > 0
        ? Math.round((completedIssues / totalIssues) * 100)
        : 0,
    working_days: workingDays,
    burndown,
  };
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

  emitSprintRealtimeEvent('sprint.created', sprint, context, {
    action: 'sprint.create',
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

  emitSprintRealtimeEvent('sprint.updated', updatedSprint, context, {
    action: 'sprint.update',
    changed_fields: Object.keys(data || {}),
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

  emitSprintRealtimeEvent('sprint.deleted', sprint, context, {
    action: 'sprint.delete',
    sprint_id: Number(id),
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

  emitSprintRealtimeEvent('sprint.started', updatedSprint, context, {
    action: 'sprint.start',
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

  emitSprintRealtimeEvent('sprint.completed', updatedSprint, context, {
    action: 'sprint.complete',
    incomplete_issue_ids: incompleteIssueIds,
    moved_to_sprint_id: moveToSprintId || null,
  });
  emitSprintIssueTaskEvents(sprint, incompleteIssueIds, context, {
    action: 'sprint.complete',
    moved_to_sprint_id: moveToSprintId || null,
  });

  return updatedSprint;
};

module.exports = {
  SPRINT_STATES,
  completeSprint,
  addIssuesToSprint,
  createSprint,
  deleteSprint,
  getActiveSprint,
  getSprintIssues,
  getSprintMetrics,
  getSprintById,
  getSprints,
  removeIssuesFromSprint,
  startSprint,
  updateSprint,
};
