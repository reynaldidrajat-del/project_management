const {
  getBacklog,
  getBacklogStats,
  moveToBacklog,
  moveToSprint,
  reorderBacklog,
} = require('../services/backlogService');
const { asyncHandler, sendError, sendSuccess } = require('../utils/responseUtils');

const getProjectId = (req) => req.params.projectId || req.query.projectId || req.query.project_id;

const getIssueIds = (req) => req.body.issue_ids || req.body.issueIds;

const listBacklog = asyncHandler(async (req, res) => {
  const projectId = getProjectId(req);

  if (!projectId) {
    return sendError(res, 'Project ID is required.', 'Validation failed.', 400);
  }

  const backlog = await getBacklog(projectId, req.query);
  return sendSuccess(res, backlog);
});

const getStats = asyncHandler(async (req, res) => {
  const projectId = getProjectId(req);

  if (!projectId) {
    return sendError(res, 'Project ID is required.', 'Validation failed.', 400);
  }

  const stats = await getBacklogStats(projectId);
  return sendSuccess(res, stats);
});

const reorder = asyncHandler(async (req, res) => {
  const projectId = getProjectId(req);
  const issueId = req.params.issueId || req.body.issue_id || req.body.issueId;
  const newPosition = req.body.new_position ?? req.body.newPosition;

  if (!projectId) {
    return sendError(res, 'Project ID is required.', 'Validation failed.', 400);
  }

  if (!issueId) {
    return sendError(res, 'Issue ID is required.', 'Validation failed.', 400);
  }

  if (!Number.isInteger(Number(newPosition)) || Number(newPosition) < 0) {
    return sendError(res, 'New position must be a non-negative integer.', 'Validation failed.', 400);
  }

  const issue = await reorderBacklog(projectId, Number(issueId), Number(newPosition));
  return sendSuccess(res, issue, 'Backlog reordered successfully.');
});

const moveIssuesToSprint = asyncHandler(async (req, res) => {
  const sprintId = req.body.sprint_id || req.body.sprintId || req.params.sprintId;

  if (!sprintId) {
    return sendError(res, 'Sprint ID is required.', 'Validation failed.', 400);
  }

  const result = await moveToSprint(getIssueIds(req), sprintId);
  return sendSuccess(res, result, 'Issues moved to sprint successfully.');
});

const moveIssuesToBacklog = asyncHandler(async (req, res) => {
  const result = await moveToBacklog(getIssueIds(req));
  return sendSuccess(res, result, 'Issues moved to backlog successfully.');
});

module.exports = {
  getStats,
  listBacklog,
  moveIssuesToBacklog,
  moveIssuesToSprint,
  reorder,
};
