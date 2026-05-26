const express = require('express');
const router = express.Router();
const {
  applyDefaults,
  checkFieldApplicability,
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
  validateRequiredFields,
  validateValue,
} = require('../controllers/customFieldController');
const { checkPermission } = require('../middlewares/permissionMiddleware');

/**
 * @route GET /api/custom-fields
 * @desc List all custom fields
 * @query {number} projectId - Filter by project ID
 */
router.get('/', listCustomFields);

/**
 * @route GET /api/custom-fields/applicable
 * @desc Get custom fields applicable to an issue type
 * @query {string} issueType - Issue type name
 * @query {number} projectId - Project ID
 */
router.get('/applicable', listApplicable);

/**
 * @route GET /api/custom-fields/issue/:issueId
 * @desc Get all custom field values for an issue
 */
router.get('/issue/:issueId', listIssueValues);

/**
 * @route PUT /api/custom-fields/issue/:issueId/:fieldId
 * @desc Set a custom field value for an issue
 */
router.put('/issue/:issueId/:fieldId', setIssueValue);

/**
 * @route DELETE /api/custom-fields/issue/:issueId/:fieldId
 * @desc Delete a custom field value for an issue
 */
router.delete('/issue/:issueId/:fieldId', deleteIssueValue);

/**
 * @route GET /api/custom-fields/issues/:issueId/values
 * @desc Get custom field values for an issue (legacy)
 */
router.get('/issues/:issueId/values', listIssueValues);

/**
 * @route POST /api/custom-fields/issues/:issueId/values
 * @desc Set multiple custom field values for an issue
 */
router.post('/issues/:issueId/values', setIssueValues);

/**
 * @route GET /api/custom-fields/issues/:issueId/validate-required
 * @desc Validate all required custom fields have values for an issue
 * @query {string} issue_type_name - Issue type name (required)
 * @query {number} project_id - Project ID (optional)
 */
router.get('/issues/:issueId/validate-required', validateRequiredFields);

/**
 * @route POST /api/custom-fields/issues/:issueId/apply-defaults
 * @desc Apply default values for custom fields on an issue
 * @body {string} issue_type_name - Issue type name (required)
 * @body {number} project_id - Project ID (optional)
 */
router.post('/issues/:issueId/apply-defaults', applyDefaults);

/**
 * @route PUT /api/custom-fields/issues/:issueId/fields/:fieldId
 * @desc Set a custom field value for an issue (legacy)
 */
router.put('/issues/:issueId/fields/:fieldId', setIssueValue);

/**
 * @route DELETE /api/custom-fields/issues/:issueId/fields/:fieldId
 * @desc Delete a custom field value (legacy)
 */
router.delete('/issues/:issueId/fields/:fieldId', deleteIssueValue);

/**
 * @route GET /api/custom-fields/:id
 * @desc Get a single custom field
 */
router.get('/:id', getCustomField);

/**
 * @route GET /api/custom-fields/:id/applicability
 * @desc Check if a custom field is applicable to an issue type
 * @query {string} issue_type_name - Issue type name (required)
 */
router.get('/:id/applicability', checkFieldApplicability);

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

module.exports = router;
