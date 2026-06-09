const {
  createIssueLink,
  deleteIssueLink,
  deleteIssueLinksForIssue,
  getIssueLinkById,
  listIssueLinks,
} = require('../services/issueLinkService');
const { asyncHandler, sendError, sendSuccess } = require('../utils/responseUtils');

const getRequestActivityContext = (req) => ({
  actor_user_id: req.user?.id || req.headers['x-user-id'] || null,
  ip_address: req.ip,
  user_agent: req.headers['user-agent'],
});

const getIssueId = (req) => req.params.issueId || req.query.issue_id || req.query.issueId;

const listLinks = asyncHandler(async (req, res) => {
  const issueId = getIssueId(req);

  if (!issueId) {
    return sendError(res, 'Issue ID is required.', 'Validation failed.', 400);
  }

  const links = await listIssueLinks(issueId, req.query);
  return sendSuccess(res, links);
});

const getLink = asyncHandler(async (req, res) => {
  const link = await getIssueLinkById(req.params.id);

  if (!link) {
    return sendError(res, 'Issue link not found.', 'Issue link not found.', 404);
  }

  return sendSuccess(res, link);
});

const createLink = asyncHandler(async (req, res) => {
  const link = await createIssueLink(req.body, getRequestActivityContext(req));
  sendSuccess(res, link, 'Issue link created successfully.', 201);
});

const deleteLink = asyncHandler(async (req, res) => {
  const result = await deleteIssueLink(req.params.id, getRequestActivityContext(req));
  sendSuccess(res, result, 'Issue link deleted successfully.');
});

const deleteLinksForIssue = asyncHandler(async (req, res) => {
  const result = await deleteIssueLinksForIssue(req.params.issueId, getRequestActivityContext(req));
  sendSuccess(res, result, 'Issue links deleted successfully.');
});

module.exports = {
  createLink,
  deleteLink,
  deleteLinksForIssue,
  getLink,
  listLinks,
};
