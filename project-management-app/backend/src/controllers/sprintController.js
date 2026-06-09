const {
  addIssuesToSprint,
  completeSprint,
  createSprint,
  deleteSprint,
  getActiveSprint,
  getSprintById,
  getSprintIssues,
  getSprintMetrics,
  getSprints,
  removeIssuesFromSprint,
  startSprint,
  updateSprint,
} = require('../services/sprintService');
const { asyncHandler, sendError, sendSuccess } = require('../utils/responseUtils');

const getRequestActivityContext = (req) => ({
  actor_user_id: req.user?.id || req.headers['x-user-id'] || null,
  ip_address: req.ip,
  user_agent: req.headers['user-agent'],
});

const getProjectId = (req) => req.params.projectId || req.query.projectId || req.query.project_id;

const listSprints = asyncHandler(async (req, res) => {
  const projectId = getProjectId(req);

  if (!projectId) {
    return sendError(res, 'Project ID is required.', 'Validation failed.', 400);
  }

  const sprints = await getSprints(projectId, req.query.state || null);
  return sendSuccess(res, sprints);
});

const getActiveProjectSprint = asyncHandler(async (req, res) => {
  const projectId = getProjectId(req);

  if (!projectId) {
    return sendError(res, 'Project ID is required.', 'Validation failed.', 400);
  }

  const sprint = await getActiveSprint(projectId);
  return sendSuccess(res, sprint);
});

const getSprint = asyncHandler(async (req, res) => {
  const sprint = await getSprintById(req.params.id);

  if (!sprint) {
    return sendError(res, 'Sprint not found.', 'Sprint not found.', 404);
  }

  return sendSuccess(res, sprint);
});

const createSprintController = asyncHandler(async (req, res) => {
  const sprint = await createSprint(req.body, getRequestActivityContext(req));
  sendSuccess(res, sprint, 'Sprint created successfully.', 201);
});

const updateSprintController = asyncHandler(async (req, res) => {
  const sprint = await updateSprint(req.params.id, req.body, getRequestActivityContext(req));
  sendSuccess(res, sprint, 'Sprint updated successfully.');
});

const deleteSprintController = asyncHandler(async (req, res) => {
  await deleteSprint(req.params.id, getRequestActivityContext(req));
  sendSuccess(res, null, 'Sprint deleted successfully.');
});

const startSprintController = asyncHandler(async (req, res) => {
  const sprint = await startSprint(req.params.id, getRequestActivityContext(req));
  sendSuccess(res, sprint, 'Sprint started successfully.');
});

const completeSprintController = asyncHandler(async (req, res) => {
  const sprint = await completeSprint(req.params.id, req.body || {}, getRequestActivityContext(req));
  sendSuccess(res, sprint, 'Sprint completed successfully.');
});

const listSprintIssues = asyncHandler(async (req, res) => {
  const issues = await getSprintIssues(req.params.id);
  sendSuccess(res, issues);
});

const addSprintIssues = asyncHandler(async (req, res) => {
  const result = await addIssuesToSprint(
    req.params.id,
    req.body.issue_ids || req.body.issueIds,
    getRequestActivityContext(req)
  );
  sendSuccess(res, result, 'Issues added to sprint successfully.');
});

const removeSprintIssues = asyncHandler(async (req, res) => {
  const result = await removeIssuesFromSprint(
    req.params.id,
    req.body.issue_ids || req.body.issueIds,
    getRequestActivityContext(req)
  );
  sendSuccess(res, result, 'Issues removed from sprint successfully.');
});

const getSprintMetricsController = asyncHandler(async (req, res) => {
  const metrics = await getSprintMetrics(req.params.id);
  sendSuccess(res, metrics);
});

module.exports = {
  addSprintIssues,
  completeSprint: completeSprintController,
  createSprint: createSprintController,
  deleteSprint: deleteSprintController,
  getActiveProjectSprint,
  getSprint,
  getSprintMetrics: getSprintMetricsController,
  listSprintIssues,
  listSprints,
  removeSprintIssues,
  startSprint: startSprintController,
  updateSprint: updateSprintController,
};
