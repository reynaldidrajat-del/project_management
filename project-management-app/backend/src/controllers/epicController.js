const {
  calculateEpicProgress,
  createEpic,
  deleteEpic,
  getEpicById,
  getEpicChildren,
  getEpics,
  linkIssueToEpic,
  unlinkIssueFromEpic,
  updateEpic,
} = require('../services/epicService');
const { asyncHandler, sendError, sendSuccess } = require('../utils/responseUtils');

const getRequestActivityContext = (req) => ({
  actor_user_id: req.user?.id || req.headers['x-user-id'] || null,
  ip_address: req.ip,
  user_agent: req.headers['user-agent'],
});

const getProjectId = (req) => req.params.projectId || req.query.projectId || req.query.project_id;

const listEpics = asyncHandler(async (req, res) => {
  const projectId = getProjectId(req);

  if (!projectId) {
    return sendError(res, 'Project ID is required.', 'Validation failed.', 400);
  }

  const epics = await getEpics(projectId);
  return sendSuccess(res, epics);
});

const getEpic = asyncHandler(async (req, res) => {
  const epic = await getEpicById(req.params.id);

  if (!epic) {
    return sendError(res, 'Epic not found.', 'Epic not found.', 404);
  }

  return sendSuccess(res, epic);
});

const createEpicController = asyncHandler(async (req, res) => {
  const epic = await createEpic(req.body, getRequestActivityContext(req));
  sendSuccess(res, epic, 'Epic created successfully.', 201);
});

const updateEpicController = asyncHandler(async (req, res) => {
  const epic = await updateEpic(req.params.id, req.body, getRequestActivityContext(req));
  sendSuccess(res, epic, 'Epic updated successfully.');
});

const deleteEpicController = asyncHandler(async (req, res) => {
  await deleteEpic(req.params.id, getRequestActivityContext(req));
  sendSuccess(res, null, 'Epic deleted successfully.');
});

const getEpicProgress = asyncHandler(async (req, res) => {
  const epic = await getEpicById(req.params.id);

  if (!epic) {
    return sendError(res, 'Epic not found.', 'Epic not found.', 404);
  }

  const progress = await calculateEpicProgress(req.params.id);
  sendSuccess(res, { epic_id: Number(req.params.id), progress });
});

const listEpicIssues = asyncHandler(async (req, res) => {
  const epic = await getEpicById(req.params.id);

  if (!epic) {
    return sendError(res, 'Epic not found.', 'Epic not found.', 404);
  }

  const issues = await getEpicChildren(req.params.id);
  sendSuccess(res, issues);
});

const linkEpicIssue = asyncHandler(async (req, res) => {
  const issueId = req.params.issueId || req.body.issue_id || req.body.issueId;

  if (!issueId) {
    return sendError(res, 'Issue ID is required.', 'Validation failed.', 400);
  }

  const issue = await linkIssueToEpic(issueId, req.params.id);
  sendSuccess(res, issue, 'Issue linked to epic successfully.');
});

const unlinkEpicIssue = asyncHandler(async (req, res) => {
  const issueId = req.params.issueId || req.body.issue_id || req.body.issueId;

  if (!issueId) {
    return sendError(res, 'Issue ID is required.', 'Validation failed.', 400);
  }

  const issue = await unlinkIssueFromEpic(issueId);
  sendSuccess(res, issue, 'Issue unlinked from epic successfully.');
});

module.exports = {
  createEpic: createEpicController,
  deleteEpic: deleteEpicController,
  getEpic,
  getEpicProgress,
  linkEpicIssue,
  listEpicIssues,
  listEpics,
  unlinkEpicIssue,
  updateEpic: updateEpicController,
};
