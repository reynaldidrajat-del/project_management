const {
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
  validateCustomFieldValue,
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
  const projectId = req.query.project_id || null;
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
  const { project_id, issue_type_name } = req.query;

  if (!issue_type_name) {
    return sendError(res, 'issue_type_name is required.', 'Validation failed.', 400);
  }

  const customFields = await getApplicableCustomFields(project_id || null, issue_type_name);
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

module.exports = {
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
  validateValue,
};
