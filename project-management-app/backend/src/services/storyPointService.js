const { query } = require('../config/db');

/**
 * Fibonacci sequence values suggested for story point estimation.
 * These are suggestions only — any non-negative integer is accepted.
 */
const FIBONACCI_SEQUENCE = [1, 2, 3, 5, 8, 13, 21];

/**
 * Validate that a story point value is acceptable.
 * Story points must be a non-negative integer or null.
 * @param {*} value - The value to validate
 * @returns {{ valid: boolean, error?: string }} Validation result
 */
const validateStoryPoints = (value) => {
  if (value === null || value === undefined) {
    return { valid: true };
  }

  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return { valid: false, error: 'Story points must be a non-negative integer.' };
  }

  if (value < 0) {
    return { valid: false, error: 'Story points must be a non-negative integer.' };
  }

  return { valid: true };
};

/**
 * Set story points on an issue (task).
 * @param {number} issueId - The task/issue ID
 * @param {number|null} points - Story point value (non-negative integer or null)
 * @param {Object} context - Activity context (actor_user_id, ip_address, user_agent)
 * @returns {Promise<Object>} Updated task with story_points
 */
const setStoryPoints = async (issueId, points, context = {}) => {
  const validation = validateStoryPoints(points);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const result = await query(
    `
    UPDATE tasks
    SET story_points = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING id, title, story_points
    `,
    [points, issueId]
  );

  if (result.rowCount === 0) {
    throw new Error('Issue not found.');
  }

  return result.rows[0];
};

/**
 * Calculate total, completed, and remaining story points for a sprint.
 * - total: sum of all issue story_points in the sprint
 * - completed: sum of story_points for issues with status = 'Done'
 * - remaining: total - completed
 * @param {number} sprintId - The sprint ID
 * @returns {Promise<{ total: number, completed: number, remaining: number }>}
 */
const getSprintStoryPoints = async (sprintId) => {
  const result = await query(
    `
    SELECT
      COALESCE(SUM(story_points), 0)::INTEGER AS total,
      COALESCE(SUM(CASE WHEN status = 'Done' THEN story_points ELSE 0 END), 0)::INTEGER AS completed
    FROM tasks
    WHERE sprint_id = $1
      AND story_points IS NOT NULL
    `,
    [sprintId]
  );

  const { total, completed } = result.rows[0];
  return { total, completed, remaining: total - completed };
};

/**
 * Calculate total, completed, and remaining story points for an epic.
 * Finds all tasks assigned to the given epic_id.
 * @param {number} epicId - The epic ID (references epics.id)
 * @returns {Promise<{ total: number, completed: number, remaining: number }>}
 */
const getEpicStoryPoints = async (epicId) => {
  const result = await query(
    `
    SELECT
      COALESCE(SUM(story_points), 0)::INTEGER AS total,
      COALESCE(SUM(CASE WHEN status = 'Done' THEN story_points ELSE 0 END), 0)::INTEGER AS completed
    FROM tasks
    WHERE epic_id = $1
      AND story_points IS NOT NULL
    `,
    [epicId]
  );

  const { total, completed } = result.rows[0];
  return { total, completed, remaining: total - completed };
};

/**
 * Calculate total story points for backlog issues (no sprint assigned) in a project.
 * @param {number} projectId - The project ID
 * @returns {Promise<{ total: number, completed: number, remaining: number }>}
 */
const getBacklogStoryPoints = async (projectId) => {
  const result = await query(
    `
    SELECT
      COALESCE(SUM(story_points), 0)::INTEGER AS total,
      COALESCE(SUM(CASE WHEN status = 'Done' THEN story_points ELSE 0 END), 0)::INTEGER AS completed
    FROM tasks
    WHERE project_id = $1
      AND sprint_id IS NULL
      AND story_points IS NOT NULL
    `,
    [projectId]
  );

  const { total, completed } = result.rows[0];
  return { total, completed, remaining: total - completed };
};

module.exports = {
  FIBONACCI_SEQUENCE,
  getBacklogStoryPoints,
  getEpicStoryPoints,
  getSprintStoryPoints,
  setStoryPoints,
  validateStoryPoints,
};
