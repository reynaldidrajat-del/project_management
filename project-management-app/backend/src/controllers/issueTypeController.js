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
 */
const listIssueTypes = asyncHandler(async (req, res) => {
  const projectId = req.query.project_id || null;
  const includeStats = req.query.include_stats === 'true';

  if (includeStats) {
    const issueTypes = await getIssueTypeStats(projectId);
    return sendSuccess(res, issueTypes);
  }

  const issueTypes = await getIssueTypes(projectId);
  sendSuccess(res, issueTypes);
});

/**
 * Get a single issue type by ID
 */
const getIssueType = asyncHandler(async (req, res) => {
  const issueType = await getIssueTypeById(req.params.id);

  if (!issueType) {
    return sendError(res, 'Issue type not found.', 'Issue type not found.', 404);
  }

  return sendSuccess(res, issueType);
});

/**
 * Create a new issue type
 */
const createIssueTypeController = asyncHandler(async (req, res) => {
  const issueType = await createIssueType(req.body, getRequestActivityContext(req));
  sendSuccess(res, issueType, 'Issue type created successfully.', 201);
});

/**
 * Update an existing issue type
 */
const updateIssueTypeController = asyncHandler(async (req, res) => {
  const issueType = await updateIssueType(req.params.id, req.body, getRequestActivityContext(req));
  sendSuccess(res, issueType, 'Issue type updated successfully.');
});

/**
 * Delete an issue type
 */
const deleteIssueTypeController = asyncHandler(async (req, res) => {
  await deleteIssueType(req.params.id, getRequestActivityContext(req));
  sendSuccess(res, null, 'Issue type deleted successfully.');
});

/**
 * Validate parent-child hierarchy
 */
const validateHierarchyController = asyncHandler(async (req, res) => {
  const { parent_type, child_type } = req.query;

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
  listIssueTypes,
  updateIssueType: updateIssueTypeController,
  validateHierarchy: validateHierarchyController,
};
