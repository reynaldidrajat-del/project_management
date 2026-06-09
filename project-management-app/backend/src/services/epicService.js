const { query } = require('../config/db');
const { logActivity } = require('./activityService');

// Issue types that can be linked to an epic (not other Epics or Subtasks)
const LINKABLE_ISSUE_TYPES = ['Story', 'Task', 'Bug'];

/**
 * Get all epics for a project.
 * Joins epics with their parent task record to get project context.
 * @param {number} projectId - Project ID
 * @returns {Promise<Array>} Array of epic objects
 */
const getEpics = async (projectId) => {
  const result = await query(
    `
    SELECT
      e.id,
      e.issue_id,
      e.epic_name,
      e.epic_color,
      e.roadmap_id,
      e.release_id,
      to_char(e.start_date, 'YYYY-MM-DD') AS start_date,
      to_char(e.target_end_date, 'YYYY-MM-DD') AS target_end_date,
      t.project_id,
      t.title AS issue_title,
      t.status AS issue_status,
      t.issue_key,
      t.story_points,
      e.created_at,
      e.updated_at
    FROM epics e
    INNER JOIN tasks t ON t.id = e.issue_id
    WHERE t.project_id = $1
    ORDER BY e.created_at DESC
    `,
    [projectId]
  );

  const epics = result.rows;

  return Promise.all(
    epics.map(async (epic) => ({
      ...epic,
      progress: await calculateEpicProgress(epic.id),
    }))
  );
};

/**
 * Get a single epic by ID with progress information.
 * @param {number} id - Epic ID
 * @returns {Promise<Object|null>} Epic object with progress or null
 */
const getEpicById = async (id) => {
  const result = await query(
    `
    SELECT
      e.id,
      e.issue_id,
      e.epic_name,
      e.epic_color,
      e.roadmap_id,
      e.release_id,
      to_char(e.start_date, 'YYYY-MM-DD') AS start_date,
      to_char(e.target_end_date, 'YYYY-MM-DD') AS target_end_date,
      t.project_id,
      t.title AS issue_title,
      t.description AS issue_description,
      t.status AS issue_status,
      t.issue_key,
      t.story_points,
      e.created_at,
      e.updated_at
    FROM epics e
    INNER JOIN tasks t ON t.id = e.issue_id
    WHERE e.id = $1
    `,
    [id]
  );

  const epic = result.rows[0] || null;

  if (epic) {
    epic.progress = await calculateEpicProgress(id);
  }

  return epic;
};

/**
 * Create a new epic. Creates both a task record (the issue) and an epic metadata record.
 * @param {Object} data - Epic creation data
 * @param {Object} context - Activity context (actor_user_id, ip_address, user_agent)
 * @returns {Promise<Object>} Created epic object
 */
const createEpic = async (data, context = {}) => {
  const {
    project_id,
    epic_name,
    epic_color = 'purple',
    description = null,
    roadmap_id = null,
    release_id = null,
    start_date = null,
    target_end_date = null,
    story_points = null,
  } = data;

  if (!project_id) {
    throw new Error('project_id is required to create an epic.');
  }

  if (!epic_name || !epic_name.trim()) {
    throw new Error('epic_name is required.');
  }

  // Find the Epic issue type
  const issueTypeResult = await query(
    `SELECT id FROM issue_types WHERE name = 'Epic' LIMIT 1`
  );

  const issueTypeId = issueTypeResult.rows[0]?.id || null;

  // Create the task record (the issue backing the epic)
  const taskResult = await query(
    `
    INSERT INTO tasks (
      project_id,
      title,
      description,
      status,
      priority,
      issue_type_id,
      story_points,
      creator_id
    )
    VALUES ($1, $2, $3, 'Not Started', 'Medium', $4, $5, $6)
    RETURNING id
    `,
    [
      project_id,
      epic_name.trim(),
      description,
      issueTypeId,
      story_points,
      context.actor_user_id || null,
    ]
  );

  const issueId = taskResult.rows[0].id;

  // Create the epic metadata record
  const epicResult = await query(
    `
    INSERT INTO epics (
      issue_id,
      epic_name,
      epic_color,
      roadmap_id,
      release_id,
      start_date,
      target_end_date
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
    `,
    [
      issueId,
      epic_name.trim(),
      epic_color,
      roadmap_id,
      release_id,
      start_date || null,
      target_end_date || null,
    ]
  );

  const epic = epicResult.rows[0];

  await logActivity({
    actor_user_id: context.actor_user_id || null,
    task_id: issueId,
    project_id,
    action: 'epic.create',
    object_type: 'epic',
    object_id: epic.id,
    description: `Epic "${epic_name}" created.`,
    metadata: { epic_name, epic_color, project_id },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  return { ...epic, issue_id: issueId, project_id };
};

/**
 * Update an existing epic.
 * @param {number} id - Epic ID
 * @param {Object} data - Fields to update
 * @param {Object} context - Activity context
 * @returns {Promise<Object>} Updated epic object
 */
const updateEpic = async (id, data, context = {}) => {
  const existing = await getEpicById(id);

  if (!existing) {
    throw new Error('Epic not found.');
  }

  const {
    epic_name = existing.epic_name,
    epic_color = existing.epic_color,
    roadmap_id = existing.roadmap_id,
    release_id = existing.release_id,
    start_date = existing.start_date,
    target_end_date = existing.target_end_date,
    description,
    story_points,
    status,
  } = data;

  // Update epic metadata
  const epicResult = await query(
    `
    UPDATE epics
    SET
      epic_name = $1,
      epic_color = $2,
      roadmap_id = $3,
      release_id = $4,
      start_date = $5,
      target_end_date = $6,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $7
    RETURNING *
    `,
    [
      epic_name,
      epic_color,
      roadmap_id || null,
      release_id || null,
      start_date || null,
      target_end_date || null,
      id,
    ]
  );

  const epic = epicResult.rows[0];

  // Update the backing task record if relevant fields changed
  const taskUpdates = [];
  const taskValues = [];
  let paramIndex = 1;

  if (epic_name !== existing.epic_name) {
    taskUpdates.push(`title = $${paramIndex++}`);
    taskValues.push(epic_name);
  }

  if (description !== undefined) {
    taskUpdates.push(`description = $${paramIndex++}`);
    taskValues.push(description);
  }

  if (story_points !== undefined) {
    taskUpdates.push(`story_points = $${paramIndex++}`);
    taskValues.push(story_points);
  }

  if (status !== undefined) {
    taskUpdates.push(`status = $${paramIndex++}`);
    taskValues.push(status);
  }

  if (taskUpdates.length > 0) {
    taskUpdates.push(`updated_at = CURRENT_TIMESTAMP`);
    taskValues.push(existing.issue_id);
    await query(
      `UPDATE tasks SET ${taskUpdates.join(', ')} WHERE id = $${paramIndex}`,
      taskValues
    );
  }

  await logActivity({
    actor_user_id: context.actor_user_id || null,
    task_id: existing.issue_id,
    project_id: existing.project_id,
    action: 'epic.update',
    object_type: 'epic',
    object_id: id,
    description: `Epic "${epic_name}" updated.`,
    metadata: { changes: data },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  return { ...epic, project_id: existing.project_id };
};

/**
 * Delete an epic and its backing task record.
 * @param {number} id - Epic ID
 * @param {Object} context - Activity context
 * @returns {Promise<void>}
 */
const deleteEpic = async (id, context = {}) => {
  const existing = await getEpicById(id);

  if (!existing) {
    throw new Error('Epic not found.');
  }

  // Unlink all children from this epic first
  await query(
    `UPDATE tasks SET epic_id = NULL WHERE epic_id = $1`,
    [id]
  );

  // Delete the epic record (cascade will handle it, but be explicit)
  await query(`DELETE FROM epics WHERE id = $1`, [id]);

  // Delete the backing task record
  await query(`DELETE FROM tasks WHERE id = $1`, [existing.issue_id]);

  await logActivity({
    actor_user_id: context.actor_user_id || null,
    task_id: existing.issue_id,
    project_id: existing.project_id,
    action: 'epic.delete',
    object_type: 'epic',
    object_id: id,
    description: `Epic "${existing.epic_name}" deleted.`,
    metadata: { epic_name: existing.epic_name },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });
};

/**
 * Calculate epic progress based on child issues.
 * Uses story points if available, otherwise falls back to count-based calculation.
 * Progress = (completed child story points / total child story points) * 100
 * Fallback = (completed children / total children) * 100
 * Always returns a value in [0, 100].
 * @param {number} epicId - Epic ID
 * @returns {Promise<number>} Progress percentage (0-100)
 */
const calculateEpicProgress = async (epicId) => {
  const result = await query(
    `
    SELECT
      t.id,
      t.status,
      COALESCE(t.story_points, 0) AS story_points
    FROM tasks t
    WHERE t.epic_id = $1
    `,
    [epicId]
  );

  const children = result.rows;

  if (children.length === 0) {
    return 0;
  }

  const totalStoryPoints = children.reduce((sum, child) => sum + child.story_points, 0);

  if (totalStoryPoints > 0) {
    // Story points-based calculation
    const completedStoryPoints = children
      .filter((child) => child.status === 'Done')
      .reduce((sum, child) => sum + child.story_points, 0);

    return Math.min(100, Math.max(0, Math.round((completedStoryPoints / totalStoryPoints) * 100)));
  }

  // Count-based fallback
  const completedCount = children.filter((child) => child.status === 'Done').length;

  return Math.min(100, Math.max(0, Math.round((completedCount / children.length) * 100)));
};

/**
 * Get all issues (children) linked to an epic.
 * @param {number} epicId - Epic ID
 * @returns {Promise<Array>} Array of child issue objects
 */
const getEpicChildren = async (epicId) => {
  const result = await query(
    `
    SELECT
      t.id,
      t.title,
      t.status,
      t.priority,
      t.story_points,
      t.issue_key,
      t.issue_type_id,
      it.name AS issue_type_name,
      it.icon AS issue_type_icon,
      it.color AS issue_type_color,
      t.assignee_id,
      u.name AS assignee_name,
      to_char(t.start_date, 'YYYY-MM-DD') AS start_date,
      to_char(t.end_date, 'YYYY-MM-DD') AS end_date,
      t.progress,
      t.created_at
    FROM tasks t
    LEFT JOIN issue_types it ON it.id = t.issue_type_id
    LEFT JOIN users u ON u.id = t.assignee_id
    WHERE t.epic_id = $1
    ORDER BY t.sort_order, t.created_at
    `,
    [epicId]
  );

  return result.rows;
};

/**
 * Link an issue to an epic.
 * Validates that the issue type is allowed (Story, Task, Bug only).
 * Prevents circular relationships.
 * @param {number} issueId - Task/issue ID to link
 * @param {number} epicId - Epic ID to link to
 * @returns {Promise<Object>} Updated task record
 */
const linkIssueToEpic = async (issueId, epicId) => {
  // Validate the epic exists
  const epicResult = await query(
    `SELECT e.id, e.issue_id FROM epics e WHERE e.id = $1`,
    [epicId]
  );

  if (epicResult.rows.length === 0) {
    throw new Error('Epic not found.');
  }

  const epic = epicResult.rows[0];

  // Prevent linking an epic to itself
  if (issueId === epic.issue_id) {
    throw new Error('An epic cannot be linked to itself.');
  }

  // Validate the issue exists and get its type
  const issueResult = await query(
    `
    SELECT t.id, t.issue_type_id, it.name AS issue_type_name
    FROM tasks t
    LEFT JOIN issue_types it ON it.id = t.issue_type_id
    WHERE t.id = $1
    `,
    [issueId]
  );

  if (issueResult.rows.length === 0) {
    throw new Error('Issue not found.');
  }

  const issue = issueResult.rows[0];

  // Validate issue type is linkable (not Epic or Subtask)
  if (issue.issue_type_name) {
    if (!LINKABLE_ISSUE_TYPES.includes(issue.issue_type_name)) {
      throw new Error(
        `Cannot link issue type "${issue.issue_type_name}" to an epic. Only ${LINKABLE_ISSUE_TYPES.join(', ')} can be linked.`
      );
    }
  }

  // Check for circular relationship: the issue being linked must not be an epic
  // that is an ancestor of the target epic
  const isCircular = await checkCircularRelationship(issueId, epicId);
  if (isCircular) {
    throw new Error('Cannot link issue to epic: circular relationship detected.');
  }

  // Perform the link
  const result = await query(
    `UPDATE tasks SET epic_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, title, epic_id`,
    [epicId, issueId]
  );

  return result.rows[0];
};

/**
 * Unlink an issue from its epic.
 * @param {number} issueId - Task/issue ID to unlink
 * @returns {Promise<Object>} Updated task record
 */
const unlinkIssueFromEpic = async (issueId) => {
  const result = await query(
    `UPDATE tasks SET epic_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id, title, epic_id`,
    [issueId]
  );

  if (result.rows.length === 0) {
    throw new Error('Issue not found.');
  }

  return result.rows[0];
};

/**
 * Check for circular epic relationships.
 * An issue cannot be linked to an epic if that issue is itself an epic
 * that is an ancestor of the target epic (directly or transitively).
 * @param {number} issueId - The issue being linked
 * @param {number} epicId - The target epic
 * @returns {Promise<boolean>} True if circular relationship would be created
 */
const checkCircularRelationship = async (issueId, epicId) => {
  // Check if the issue being linked is itself an epic
  const issueEpicResult = await query(
    `SELECT id FROM epics WHERE issue_id = $1`,
    [issueId]
  );

  // If the issue is not an epic, no circular relationship is possible
  if (issueEpicResult.rows.length === 0) {
    return false;
  }

  // The issue is an epic. Check if the target epic is a descendant of this epic.
  // Walk up the ancestor chain from the target epic to see if we reach the issue's epic.
  const issueEpicId = issueEpicResult.rows[0].id;
  const visited = new Set();
  let currentEpicId = epicId;

  while (currentEpicId) {
    if (currentEpicId === issueEpicId) {
      return true; // Circular: target epic is a descendant of the issue's epic
    }

    if (visited.has(currentEpicId)) {
      break; // Already visited, prevent infinite loop
    }

    visited.add(currentEpicId);

    // Get the epic's backing task and check if that task is linked to another epic
    const parentResult = await query(
      `
      SELECT t.epic_id
      FROM epics e
      INNER JOIN tasks t ON t.id = e.issue_id
      WHERE e.id = $1
      `,
      [currentEpicId]
    );

    if (parentResult.rows.length === 0 || parentResult.rows[0].epic_id === null) {
      break;
    }

    currentEpicId = parentResult.rows[0].epic_id;
  }

  return false;
};

module.exports = {
  getEpics,
  getEpicById,
  createEpic,
  updateEpic,
  deleteEpic,
  calculateEpicProgress,
  getEpicChildren,
  linkIssueToEpic,
  unlinkIssueFromEpic,
};
