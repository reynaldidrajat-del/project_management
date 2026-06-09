const {
  createWorkLog,
  deleteWorkLog,
  getIssueTimeTracking,
  getTimeTrackingReport,
  getWorkLogById,
  listWorkLogs,
  updateIssueEstimates,
} = require('../services/timeTrackingService');
const { asyncHandler, sendError, sendSuccess } = require('../utils/responseUtils');

const getRequestActivityContext = (req) => ({
  actor_user_id: req.user?.id || req.headers['x-user-id'] || null,
  ip_address: req.ip,
  user_agent: req.headers['user-agent'],
});

const listLogs = asyncHandler(async (req, res) => {
  const logs = await listWorkLogs(req.query);
  sendSuccess(res, logs);
});

const getLog = asyncHandler(async (req, res) => {
  const workLog = await getWorkLogById(req.params.id);

  if (!workLog) {
    return sendError(res, 'Work log not found.', 'Work log not found.', 404);
  }

  return sendSuccess(res, workLog);
});

const getIssueSummary = asyncHandler(async (req, res) => {
  const summary = await getIssueTimeTracking(req.params.issueId);
  sendSuccess(res, summary);
});

const updateEstimates = asyncHandler(async (req, res) => {
  const summary = await updateIssueEstimates(req.params.issueId, req.body, getRequestActivityContext(req));
  sendSuccess(res, summary, 'Issue estimates updated successfully.');
});

const createLog = asyncHandler(async (req, res) => {
  const workLog = await createWorkLog(req.params.issueId, req.body, getRequestActivityContext(req));
  sendSuccess(res, workLog, 'Work log created successfully.', 201);
});

const deleteLog = asyncHandler(async (req, res) => {
  const result = await deleteWorkLog(req.params.id, getRequestActivityContext(req));
  sendSuccess(res, result, 'Work log deleted successfully.');
});

const getReport = asyncHandler(async (req, res) => {
  const report = await getTimeTrackingReport(req.query);
  sendSuccess(res, report);
});

module.exports = {
  createLog,
  deleteLog,
  getIssueSummary,
  getLog,
  getReport,
  listLogs,
  updateEstimates,
};
