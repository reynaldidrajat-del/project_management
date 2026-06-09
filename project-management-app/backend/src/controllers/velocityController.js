const {
  getSprintVelocity,
  getVelocitySummary,
  listVelocityHistory,
  syncClosedSprintVelocityHistory,
  upsertSprintVelocityHistory,
} = require('../services/velocityService');
const { asyncHandler, sendSuccess } = require('../utils/responseUtils');

const getRequestActivityContext = (req) => ({
  actor_user_id: req.user?.id || req.headers['x-user-id'] || null,
  ip_address: req.ip,
  user_agent: req.headers['user-agent'],
});

const getSprint = asyncHandler(async (req, res) => {
  const velocity = await getSprintVelocity(req.params.sprintId);
  sendSuccess(res, velocity);
});

const syncSprint = asyncHandler(async (req, res) => {
  const history = await upsertSprintVelocityHistory(req.params.sprintId, getRequestActivityContext(req));
  sendSuccess(res, history, 'Sprint velocity history updated.');
});

const listProjectHistory = asyncHandler(async (req, res) => {
  const history = await listVelocityHistory(req.params.projectId, req.query);
  sendSuccess(res, history);
});

const syncProjectHistory = asyncHandler(async (req, res) => {
  const history = await syncClosedSprintVelocityHistory(req.params.projectId, getRequestActivityContext(req));
  sendSuccess(res, history, 'Project velocity history synced.');
});

const getProjectSummary = asyncHandler(async (req, res) => {
  const summary = await getVelocitySummary(req.params.projectId, req.query);
  sendSuccess(res, summary);
});

module.exports = {
  getProjectSummary,
  getSprint,
  listProjectHistory,
  syncProjectHistory,
  syncSprint,
};
