const {
  convertIssueType,
  createSubtask,
  getIssueHierarchy,
} = require('../services/hierarchyService');
const { asyncHandler, sendSuccess } = require('../utils/responseUtils');

const getRequestActivityContext = (req) => ({
  actor_user_id: req.user?.id || req.headers['x-user-id'] || null,
  ip_address: req.ip,
  user_agent: req.headers['user-agent'],
});

const getHierarchy = asyncHandler(async (req, res) => {
  const hierarchy = await getIssueHierarchy(req.params.issueId);
  sendSuccess(res, hierarchy);
});

const createIssueSubtask = asyncHandler(async (req, res) => {
  const subtask = await createSubtask(req.params.issueId, req.body, getRequestActivityContext(req));
  sendSuccess(res, subtask, 'Subtask created successfully.', 201);
});

const convertIssue = asyncHandler(async (req, res) => {
  const issue = await convertIssueType(req.params.issueId, req.body, getRequestActivityContext(req));
  sendSuccess(res, issue, 'Issue type converted successfully.');
});

module.exports = {
  convertIssue,
  createIssueSubtask,
  getHierarchy,
};
