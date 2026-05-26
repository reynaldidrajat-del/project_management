const express = require('express');
const router = express.Router();
const {
  createCustomField,
  deleteCustomField,
  deleteIssueValue,
  getCustomField,
  listApplicable,
  listCustomFields,
  listIssueValues,
  setIssueValue,
  setIssueValues,
  updateCustomField,
  validateValue,
} = require('../controllers/customFieldController');
const { authenticateRequest } = require('../middlewares/authMiddleware');
const { checkPermission } = require('../middlewares/permissionMiddleware');

// All routes require authentication
router.use(authenticateRequest);

/**
 * @route GET /api/custom-fields
 * @desc List all custom fields
 * @query {number} project_id - Filter by project ID
 */
router.get('/', listCustomFields);

/**
 * @route GET /api/custom-fields/applicable
 * @desc Get custom fields applicable to an issue type
 * @query {number} project_id - Project ID
 * @query {string} issue_type_name - Issue type name
 */
router.get('/applicable', listApplicable);

/**
 * @route GET /api/custom-fields/:id
 * @desc Get a single custom field
 */
router.get('/:id', getCustomField);

/**
 * @route POST /api/custom-fields
 * @desc Create a new custom field
 */
router.post('/', checkPermission('manage_custom_fields'), createCustomField);

/**
 * @route PUT /api/custom-fields/:id
 * @desc Update a custom field
 */
router.put('/:id', checkPermission('manage_custom_fields'), updateCustomField);

/**
 * @route DELETE /api/custom-fields/:id
 * @desc Delete a custom field
 */
router.delete('/:id', checkPermission('manage_custom_fields'), deleteCustomField);

/**
 * @route POST /api/custom-fields/:id/validate
 * @desc Validate a custom field value
 */
router.post('/:id/validate', validateValue);

/**
 * @route GET /api/custom-fields/issues/:issueId/values
 * @desc Get custom field values for an issue
 */
router.get('/issues/:issueId/values', listIssueValues);

/**
 * @route POST /api/custom-fields/issues/:issueId/values
 * @desc Set multiple custom field values for an issue
 */
router.post('/issues/:issueId/values', setIssueValues);

/**
 * @route PUT /api/custom-fields/issues/:issueId/fields/:fieldId
 * @desc Set a custom field value for an issue
 */
router.put('/issues/:issueId/fields/:fieldId', setIssueValue);

/**
 * @route DELETE /api/custom-fields/issues/:issueId/fields/:fieldId
 * @desc Delete a custom field value
 */
router.delete('/issues/:issueId/fields/:fieldId', deleteIssueValue);

module.exports = router;
