const {
  createIssueFromTemplate,
  createTemplate,
  deleteTemplate,
  getTemplateById,
  listTemplates,
  previewTemplateApplication,
  updateTemplate,
} = require('../services/templateService');
const { asyncHandler, sendError, sendSuccess } = require('../utils/responseUtils');

const getRequestActivityContext = (req) => ({
  actor_user_id: req.user?.id || req.headers['x-user-id'] || null,
  ip_address: req.ip,
  user_agent: req.headers['user-agent'],
});

const list = asyncHandler(async (req, res) => {
  const templates = await listTemplates(req.query);
  sendSuccess(res, templates);
});

const get = asyncHandler(async (req, res) => {
  const template = await getTemplateById(req.params.id);

  if (!template) {
    return sendError(res, 'Issue template not found.', 'Issue template not found.', 404);
  }

  return sendSuccess(res, template);
});

const create = asyncHandler(async (req, res) => {
  const template = await createTemplate(req.body, getRequestActivityContext(req));
  sendSuccess(res, template, 'Issue template created successfully.', 201);
});

const update = asyncHandler(async (req, res) => {
  const template = await updateTemplate(req.params.id, req.body, getRequestActivityContext(req));
  sendSuccess(res, template, 'Issue template updated successfully.');
});

const remove = asyncHandler(async (req, res) => {
  const result = await deleteTemplate(req.params.id, getRequestActivityContext(req));
  sendSuccess(res, result, 'Issue template archived successfully.');
});

const preview = asyncHandler(async (req, res) => {
  const result = await previewTemplateApplication(req.params.id, req.body || {});
  sendSuccess(res, result);
});

const apply = asyncHandler(async (req, res) => {
  const result = await createIssueFromTemplate(req.params.id, req.body || {}, getRequestActivityContext(req));
  sendSuccess(res, result, 'Issue created from template successfully.', 201);
});

module.exports = {
  apply,
  create,
  get,
  list,
  preview,
  remove,
  update,
};
