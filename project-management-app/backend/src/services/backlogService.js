const { query } = require('../config/db');

/**
 * Ensure the backlog_order column exists on the tasks table.
 * Called once at module load to guarantee the column is available.
 */
const ensureBacklogOrderColumn = async () => {
  await query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS backlog_order INTEGER`);
};

// Run migration on first load (non-blocking)
ensureBacklogOrderColumn().catch(() => {
  // Silently ignore if column already exists or DB not ready yet
});

/**
 * Get backlog issues for a project (issues not assigned to any sprint).
 * Supports optional filtering by issue type, assignee, epic, priority, and text search.
 * Includes epic information for grouping display.
 *
 * @param {number} projectId - Project ID
 * @param {Object} [filters={}] - Optional filters
 * @param {number} [filters.issue_type_id] - Filter by issue type ID
 * @param {number} [filters.assignee_id] - Filter by assignee user ID
 * @param {number} [filters.epic_id] - Filter by epic ID
 * @param {string} [filters.priority] - Filter by priority value
 * @param {string} [filters.search] - Text search on task title
 * @returns {Promise<Array>} Array of backlog issues ordered by backlog_order
 */
const getBacklog = async (projectId, filters = {}) => {
  const conditions = ['t.project_id = $1', 't.sprint_id IS NULL'];
  const params = [projectId];
  let paramIndex = 1;

  // Filter by issue type
  if (filters.issue_type_id) {
    paramIndex++;
    conditions.push(`t.issue_type_id = $${paramIndex}`);
    params.push(filters.issue_type_id);
  }

  // Filter by assignee
  if (filters.assignee_id) {
    paramIndex++;
    conditions.push(`t.assignee_id = $${paramIndex}`);
    params.push(filters.assignee_id);
  }

  // Filter by epic
  if (filters.epic_id) {
    paramIndex++;
    conditions.push(`t.epic_id = $${paramIndex}`);
    params.push(filters.epic_id);
  }

  // Filter by priority
  if (filters.priority) {
    paramIndex++;
    conditions.push(`t.priority = $${paramIndex}`);
    params.push(filters.priority);
  }

  // Text search on title
  if (filters.search) {
    paramIndex++;
    conditions.push(`t.title ILIKE $${paramIndex}`);
    params.push(`%${filters.search}%`);
  }

  const whereClause = conditions.join(' AND ');

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
      t.assignee_id,
      t.project_id,
      t.backlog_order,
      t.created_at,
      t.updated_at,
      it.name AS issue_type_name,
      it.icon AS issue_type_icon,
      it.color AS issue_type_color,
      e.epic_name,
      e.epic_color,
      u.name AS assignee_name
    FROM tasks t
    LEFT JOIN issue_types it ON it.id = t.issue_type_id
    LEFT JOIN epics e ON e.id = t.epic_id
    LEFT JOIN users u ON u.id = t.assignee_id
    WHERE ${whereClause}
    ORDER BY t.backlog_order ASC NULLS LAST, t.created_at DESC
    `,
    params
  );

  return result.rows;
};

/**
 * Reorder a backlog issue to a new position.
 * Updates the backlog_order of the moved issue and shifts affected issues.
 * Lower backlog_order = higher priority (appears first).
 *
 * @param {number} projectId - Project ID
 * @param {number} issueId - The issue ID to reorder
 * @param {number} newPosition - The new position (0-based index)
 * @returns {Promise<Object>} The updated issue
 */
const reorderBacklog = async (projectId, issueId, newPosition) => {
  // Verify the issue belongs to the project and is in the backlog
  const issueResult = await query(
    `SELECT id, backlog_order FROM tasks WHERE id = $1 AND project_id = $2 AND sprint_id IS NULL`,
    [issueId, projectId]
  );

  if (issueResult.rows.length === 0) {
    throw new Error('Issue not found in project backlog.');
  }

  const currentOrder = issueResult.rows[0].backlog_order;

  // Get all backlog issues ordered by current position
  const backlogResult = await query(
    `
    SELECT id, backlog_order
    FROM tasks
    WHERE project_id = $1 AND sprint_id IS NULL
    ORDER BY backlog_order ASC NULLS LAST, created_at DESC
    `,
    [projectId]
  );

  const backlogIssues = backlogResult.rows;

  // Remove the issue from its current position
  const filteredIssues = backlogIssues.filter((item) => item.id !== issueId);

  // Clamp newPosition to valid range
  const clampedPosition = Math.max(0, Math.min(newPosition, filteredIssues.length));

  // Insert at new position
  filteredIssues.splice(clampedPosition, 0, { id: issueId });

  // Update backlog_order for all affected issues
  const updates = filteredIssues.map((item, index) => ({
    id: item.id,
    backlog_order: index + 1,
  }));

  // Batch update using a single query with CASE
  if (updates.length > 0) {
    const caseStatements = updates
      .map((u, i) => `WHEN id = $${i * 2 + 1}::INTEGER THEN $${i * 2 + 2}::INTEGER`)
      .join(' ');
    const ids = updates.map((u) => u.id);
    const flatParams = updates.flatMap((u) => [u.id, u.backlog_order]);

    await query(
      `
      UPDATE tasks
      SET backlog_order = CASE ${caseStatements} END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ANY($${flatParams.length + 1}::INTEGER[])
      `,
      [...flatParams, ids]
    );
  }

  // Return the updated issue
  const updatedResult = await query(
    `
    SELECT
      t.id,
      t.title,
      t.backlog_order,
      t.priority,
      t.issue_type_id,
      t.epic_id,
      t.story_points,
      t.assignee_id
    FROM tasks t
    WHERE t.id = $1
    `,
    [issueId]
  );

  return updatedResult.rows[0];
};

/**
 * Move issues from backlog to a sprint.
 * Sets sprint_id on the specified issues.
 *
 * @param {number[]} issueIds - Array of issue IDs to move
 * @param {number} sprintId - Target sprint ID
 * @returns {Promise<Object>} Result with count of moved issues
 */
const moveToSprint = async (issueIds, sprintId) => {
  if (!issueIds || issueIds.length === 0) {
    throw new Error('No issues specified to move.');
  }

  if (!sprintId) {
    throw new Error('Sprint ID is required.');
  }

  // Verify sprint exists
  const sprintResult = await query(
    `SELECT id, project_id, state FROM sprints WHERE id = $1`,
    [sprintId]
  );

  if (sprintResult.rows.length === 0) {
    throw new Error('Sprint not found.');
  }

  const sprint = sprintResult.rows[0];

  // Update issues: set sprint_id and clear backlog_order
  const result = await query(
    `
    UPDATE tasks
    SET sprint_id = $1,
        backlog_order = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ANY($2)
      AND project_id = $3
      AND sprint_id IS NULL
    RETURNING id
    `,
    [sprintId, issueIds, sprint.project_id]
  );

  return {
    moved_count: result.rowCount,
    sprint_id: sprintId,
    issue_ids: result.rows.map((r) => r.id),
  };
};

/**
 * Move issues from a sprint back to the backlog.
 * Clears sprint_id and assigns backlog_order at the end of the backlog.
 *
 * @param {number[]} issueIds - Array of issue IDs to move to backlog
 * @returns {Promise<Object>} Result with count of moved issues
 */
const moveToBacklog = async (issueIds) => {
  if (!issueIds || issueIds.length === 0) {
    throw new Error('No issues specified to move.');
  }

  // Get the project_id from the first issue to determine max backlog_order
  const issueCheck = await query(
    `SELECT id, project_id FROM tasks WHERE id = ANY($1) AND sprint_id IS NOT NULL`,
    [issueIds]
  );

  if (issueCheck.rows.length === 0) {
    throw new Error('No valid issues found to move to backlog.');
  }

  const projectId = issueCheck.rows[0].project_id;

  // Get current max backlog_order for the project
  const maxOrderResult = await query(
    `SELECT COALESCE(MAX(backlog_order), 0) AS max_order FROM tasks WHERE project_id = $1 AND sprint_id IS NULL`,
    [projectId]
  );

  let nextOrder = maxOrderResult.rows[0].max_order + 1;

  // Move each issue to backlog with incrementing order
  const movedIds = [];
  for (const issueId of issueIds) {
    const result = await query(
      `
      UPDATE tasks
      SET sprint_id = NULL,
          backlog_order = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
        AND project_id = $3
        AND sprint_id IS NOT NULL
      RETURNING id
      `,
      [nextOrder, issueId, projectId]
    );

    if (result.rowCount > 0) {
      movedIds.push(result.rows[0].id);
      nextOrder++;
    }
  }

  return {
    moved_count: movedIds.length,
    issue_ids: movedIds,
  };
};

/**
 * Get backlog statistics for a project.
 * Returns total issue count and total story points.
 *
 * @param {number} projectId - Project ID
 * @returns {Promise<Object>} Backlog statistics
 */
const getBacklogStats = async (projectId) => {
  const result = await query(
    `
    SELECT
      COUNT(*)::INTEGER AS total_issues,
      COALESCE(SUM(story_points), 0)::INTEGER AS total_story_points,
      COUNT(CASE WHEN epic_id IS NOT NULL THEN 1 END)::INTEGER AS issues_with_epic,
      COUNT(DISTINCT epic_id)::INTEGER AS epic_count
    FROM tasks
    WHERE project_id = $1
      AND sprint_id IS NULL
    `,
    [projectId]
  );

  return result.rows[0];
};

module.exports = {
  getBacklog,
  getBacklogStats,
  moveToBacklog,
  moveToSprint,
  reorderBacklog,
};
