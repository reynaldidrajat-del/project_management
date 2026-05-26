const {
  applyDefaultValues,
  createCustomField,
  deleteCustomField,
  deleteCustomFieldValue,
  getApplicableCustomFields,
  getCustomFieldById,
  getCustomFieldValues,
  getCustomFields,
  setCustomFieldValue,
  setCustomFieldValues,
  updateCustomField,
  validateAllRequiredFields,
  validateCustomFieldValue,
  validateFieldApplicability,
} = require('../services/customFieldService');
const { asyncHandler, sendError, sendSuccess } = require('../utils/responseUtils');

const getRequestActivityContext = (req) => ({
  actor_user_id: req.user?.id || req.headers['x-user-id'] || null,
  ip_address: req.ip,
  user_agent: req.headers['user-agent'],
});

/**
 * List all custom fields
 */
const listCustomFields = asyncHandler(async (req, res) => {
  const projectId = req.query.projectId || req.query.project_id || null;
  const customFields = await getCustomFields(projectId);
  sendSuccess(res, customFields);
});

/**
 * Get a single custom field
 */
const getCustomField = asyncHandler(async (req, res) => {
  const customField = await getCustomFieldById(req.params.id);

  if (!customField) {
    return sendError(res, 'Custom field not found.', 'Custom field not found.', 404);
  }

  return sendSuccess(res, customField);
});

/**
 * Create a new custom field
 */
const createCustomFieldController = asyncHandler(async (req, res) => {
  const customField = await createCustomField(req.body, getRequestActivityContext(req));
  sendSuccess(res, customField, 'Custom field created successfully.', 201);
});

/**
 * Update a custom field
 */
const updateCustomFieldController = asyncHandler(async (req, res) => {
  const customField = await updateCustomField(req.params.id, req.body, getRequestActivityContext(req));
  sendSuccess(res, customField, 'Custom field updated successfully.');
});

/**
 * Delete a custom field
 */
const deleteCustomFieldController = asyncHandler(async (req, res) => {
  await deleteCustomField(req.params.id, getRequestActivityContext(req));
  sendSuccess(res, null, 'Custom field deleted successfully.');
});

/**
 * Validate a custom field value
 */
const validateValue = asyncHandler(async (req, res) => {
  const validation = await validateCustomFieldValue(req.params.id, req.body.value);
  sendSuccess(res, validation);
});

/**
 * Get custom fields applicable to an issue type
 */
const listApplicable = asyncHandler(async (req, res) => {
  const projectId = req.query.projectId || req.query.project_id || null;
  const issueType = req.query.issueType || req.query.issue_type_name || null;

  if (!issueType) {
    return sendError(res, 'issueType is required.', 'Validation failed.', 400);
  }

  const customFields = await getApplicableCustomFields(projectId, issueType);
  sendSuccess(res, customFields);
});

/**
 * Get custom field values for an issue
 */
const listIssueValues = asyncHandler(async (req, res) => {
  const values = await getCustomFieldValues(req.params.issueId);
  sendSuccess(res, values);
});

/**
 * Set a custom field value for an issue
 */
const setIssueValue = asyncHandler(async (req, res) => {
  const value = await setCustomFieldValue(
    req.params.issueId,
    req.params.fieldId,
    req.body.value,
    getRequestActivityContext(req)
  );
  sendSuccess(res, value, 'Custom field value set successfully.');
});

/**
 * Set multiple custom field values for an issue
 */
const setIssueValues = asyncHandler(async (req, res) => {
  const values = await setCustomFieldValues(
    req.params.issueId,
    req.body.values,
    getRequestActivityContext(req)
  );
  sendSuccess(res, values, 'Custom field values set successfully.');
});

/**
 * Delete a custom field value
 */
const deleteIssueValue = asyncHandler(async (req, res) => {
  await deleteCustomFieldValue(req.params.issueId, req.params.fieldId);
  sendSuccess(res, null, 'Custom field value deleted successfully.');
});

/**
 * Validate all required custom fields for an issue
 */
const validateRequiredFields = asyncHandler(async (req, res) => {
  const { issueId } = req.params;
  const { issue_type_name, project_id } = req.query;

  if (!issue_type_name) {
    return sendError(res, 'issue_type_name is required.', 'Validation failed.', 400);
  }

  const result = await validateAllRequiredFields(
    Number(issueId),
    issue_type_name,
    project_id ? Number(project_id) : null
  );
  sendSuccess(res, result);
});

/**
 * Apply default values for custom fields on an issue
 */
const applyDefaults = asyncHandler(async (req, res) => {
  const { issueId } = req.params;
  const { issue_type_name, project_id } = req.body;

  if (!issue_type_name) {
    return sendError(res, 'issue_type_name is required.', 'Validation failed.', 400);
  }

  const appliedDefaults = await applyDefaultValues(
    Number(issueId),
    issue_type_name,
    project_id ? Number(project_id) : null
  );
  sendSuccess(res, appliedDefaults, 'Default values applied successfully.');
});

/**
 * Check if a custom field is applicable to an issue type
 */
const checkFieldApplicability = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { issue_type_name } = req.query;

  if (!issue_type_name) {
    return sendError(res, 'issue_type_name is required.', 'Validation failed.', 400);
  }

  const result = await validateFieldApplicability(Number(id), issue_type_name);
  sendSuccess(res, result);
});

module.exports = {
  applyDefaults,
  checkFieldApplicability,
  createCustomField: createCustomFieldController,
  deleteCustomField: deleteCustomFieldController,
  deleteIssueValue,
  getCustomField,
  listApplicable,
  listCustomFields,
  listIssueValues,
  setIssueValue,
  setIssueValues,
  updateCustomField: updateCustomFieldController,
  validateRequiredFields,
  validateValue,
};
