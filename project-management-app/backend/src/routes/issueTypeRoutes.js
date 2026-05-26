const express = require('express');
const router = express.Router();
const {
  createIssueType,
  deleteIssueType,
  getIssueType,
  getIssueTypeStats,
  listIssueTypes,
  updateIssueType,
  validateHierarchy,
} = require('../controllers/issueTypeController');
const { authenticateRequest } = require('../middlewares/authMiddleware');
const { checkPermission } = require('../middlewares/permissionMiddleware');

// All routes require authentication
router.use(authenticateRequest);

/**
 * @route GET /api/issue-types/stats
 * @desc Get issue type statistics (count of issues per type)
 * @query {number} projectId - Filter by project ID
 */
router.get('/stats', getIssueTypeStats);

/**
 * @route POST /api/issue-types/validate-hierarchy
 * @desc Validate parent-child hierarchy
 * @body {string} parent_type - Parent issue type name
 * @body {string} child_type - Child issue type name
 */
router.post('/validate-hierarchy', validateHierarchy);

/**
 * @route GET /api/issue-types
 * @desc List all issue types (optionally filtered by project)
 * @query {number} projectId - Filter by project ID
 */
router.get('/', listIssueTypes);

/**
 * @route GET /api/issue-types/:id
 * @desc Get a single issue type by ID
 */
router.get('/:id', getIssueType);

/**
 * @route POST /api/issue-types
 * @desc Create a new issue type
 * @body {string} name - Issue type name
 * @body {string} [icon] - Icon identifier
 * @body {string} [color] - Color hex code
 * @body {number} [hierarchy_level] - Hierarchy level
 * @body {string[]} [allowed_parent_types] - Allowed parent types
 * @body {string[]} [allowed_child_types] - Allowed child types
 * @body {number} [default_workflow_id] - Default workflow ID
 * @body {number} [project_id] - Project ID for project-specific types
 */
router.post('/', checkPermission('manage_issue_types'), createIssueType);

/**
 * @route PUT /api/issue-types/:id
 * @desc Update an existing issue type
 */
router.put('/:id', checkPermission('manage_issue_types'), updateIssueType);

/**
 * @route DELETE /api/issue-types/:id
 * @desc Delete an issue type
 */
router.delete('/:id', checkPermission('manage_issue_types'), deleteIssueType);

module.exports = router;
