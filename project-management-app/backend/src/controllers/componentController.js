const {
  createComponent,
  deleteComponent,
  ensureProjectComponentVisibility,
  getComponentById,
  getComponentMetrics,
  getIssueComponentProjectId,
  getIssueComponents,
  listComponents,
  replaceIssueComponents,
  updateComponent,
} = require('../services/componentService');
const { asyncHandler, sendError, sendSuccess } = require('../utils/responseUtils');

const getRequestActivityContext = (req) => ({
  actor_role: req.user?.role || req.headers['x-user-role'] || null,
  actor_user_id: req.user?.id || req.headers['x-user-id'] || null,
  ip_address: req.ip,
  user_agent: req.headers['user-agent'],
});

const getProjectId = (req) => req.params.projectId || req.query.projectId || req.query.project_id;

const listProjectComponents = asyncHandler(async (req, res) => {
  const projectId = getProjectId(req);

  if (!projectId) {
    return sendError(res, 'Project ID is required.', 'Validation failed.', 400);
  }

  await ensureProjectComponentVisibility(projectId, getRequestActivityContext(req));
  const components = await listComponents(projectId);
  return sendSuccess(res, components);
});

const getComponent = asyncHandler(async (req, res) => {
  const component = await getComponentById(req.params.id);

  if (!component) {
    return sendError(res, 'Component not found.', 'Component not found.', 404);
  }

  await ensureProjectComponentVisibility(component.project_id, getRequestActivityContext(req));
  return sendSuccess(res, component);
});

const createComponentController = asyncHandler(async (req, res) => {
  const component = await createComponent(req.body, getRequestActivityContext(req));
  sendSuccess(res, component, 'Component created successfully.', 201);
});

const updateComponentController = asyncHandler(async (req, res) => {
  const component = await updateComponent(req.params.id, req.body, getRequestActivityContext(req));
  sendSuccess(res, component, 'Component updated successfully.');
});

const deleteComponentController = asyncHandler(async (req, res) => {
  const component = await deleteComponent(req.params.id, getRequestActivityContext(req));
  sendSuccess(res, component, 'Component deleted successfully.');
});

const getMetrics = asyncHandler(async (req, res) => {
  const component = await getComponentById(req.params.id);

  if (!component) {
    return sendError(res, 'Component not found.', 'Component not found.', 404);
  }

  await ensureProjectComponentVisibility(component.project_id, getRequestActivityContext(req));
  const metrics = await getComponentMetrics(req.params.id);
  sendSuccess(res, metrics);
});

const listIssueComponents = asyncHandler(async (req, res) => {
  const projectId = await getIssueComponentProjectId(req.params.issueId);
  await ensureProjectComponentVisibility(projectId, getRequestActivityContext(req));
  const issueComponents = await getIssueComponents(req.params.issueId);
  sendSuccess(res, issueComponents);
});

const replaceIssueComponentsController = asyncHandler(async (req, res) => {
  const componentIds = req.body.component_ids || req.body.componentIds || [];
  const result = await replaceIssueComponents(req.params.issueId, componentIds, {
    ...getRequestActivityContext(req),
    applyDefaultAssignee: req.body.apply_default_assignee ?? req.body.applyDefaultAssignee,
  });

  sendSuccess(res, result, 'Issue components updated successfully.');
});

module.exports = {
  createComponent: createComponentController,
  deleteComponent: deleteComponentController,
  getComponent,
  getMetrics,
  listIssueComponents,
  listProjectComponents,
  replaceIssueComponents: replaceIssueComponentsController,
  updateComponent: updateComponentController,
};
