const {
  createIssueType,
  deleteIssueType,
  getIssueTypeById,
  getIssueTypeStats,
  getIssueTypes,
  updateIssueType,
  validateHierarchy,
} = require('../services/issueTypeService');
const { asyncHandler, sendError, sendSuccess } = require('../utils/responseUtils');

const getRequestActivityContext = (req) => ({
  actor_user_id: req.user?.id || req.headers['x-user-id'] || null,
  ip_address: req.ip,
  user_agent: req.headers['user-agent'],
});

/**
 * List all issue types (optionally filtered by project)
 * GET /api/issue-types?projectId=X
 */
const listIssueTypes = asyncHandler(async (req, res) => {
  const projectId = req.query.projectId || req.query.project_id || null;

  const issueTypes = await getIssueTypes(projectId);
  sendSuccess(res, issueTypes);
});

/**
 * Get a single issue type by ID
 * GET /api/issue-types/:id
 */
const getIssueType = asyncHandler(async (req, res) => {
  const issueType = await getIssueTypeById(req.params.id);

  if (!issueType) {
    return sendError(res, 'Issue type not found.', 'Issue type not found.', 404);
  }

  return sendSuccess(res, issueType);
});

/**
 * Get issue type statistics
 * GET /api/issue-types/stats?projectId=X
 */
const getIssueTypeStatsController = asyncHandler(async (req, res) => {
  const projectId = req.query.projectId || req.query.project_id || null;

  const stats = await getIssueTypeStats(projectId);
  sendSuccess(res, stats);
});

/**
 * Create a new issue type
 * POST /api/issue-types
 */
const createIssueTypeController = asyncHandler(async (req, res) => {
  const issueType = await createIssueType(req.body, getRequestActivityContext(req));
  sendSuccess(res, issueType, 'Issue type created successfully.', 201);
});

/**
 * Update an existing issue type
 * PUT /api/issue-types/:id
 */
const updateIssueTypeController = asyncHandler(async (req, res) => {
  const issueType = await updateIssueType(req.params.id, req.body, getRequestActivityContext(req));
  sendSuccess(res, issueType, 'Issue type updated successfully.');
});

/**
 * Delete an issue type
 * DELETE /api/issue-types/:id
 */
const deleteIssueTypeController = asyncHandler(async (req, res) => {
  await deleteIssueType(req.params.id, getRequestActivityContext(req));
  sendSuccess(res, null, 'Issue type deleted successfully.');
});

/**
 * Validate parent-child hierarchy
 * POST /api/issue-types/validate-hierarchy
 */
const validateHierarchyController = asyncHandler(async (req, res) => {
  const { parent_type, child_type } = req.body;

  if (!parent_type || !child_type) {
    return sendError(res, 'Both parent_type and child_type are required.', 'Validation failed.', 400);
  }

  const isValid = validateHierarchy(parent_type, child_type);
  sendSuccess(res, { valid: isValid, parent_type, child_type });
});

module.exports = {
  createIssueType: createIssueTypeController,
  deleteIssueType: deleteIssueTypeController,
  getIssueType,
  getIssueTypeStats: getIssueTypeStatsController,
  listIssueTypes,
  updateIssueType: updateIssueTypeController,
  validateHierarchy: validateHierarchyController,
};
