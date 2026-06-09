const {
  getDashboardMetrics,
  getDashboardPreference,
  updateDashboardPreference,
} = require('../services/dashboardMetricsService');
const { asyncHandler, sendSuccess } = require('../utils/responseUtils');

const getMetrics = asyncHandler(async (req, res) => {
  const metrics = await getDashboardMetrics(req.query);
  sendSuccess(res, metrics);
});

const getPreference = asyncHandler(async (req, res) => {
  const preference = await getDashboardPreference(req.user?.id || req.headers['x-user-id'], req.query.project_id || req.query.projectId);
  sendSuccess(res, preference);
});

const updatePreference = asyncHandler(async (req, res) => {
  const preference = await updateDashboardPreference(req.user?.id || req.headers['x-user-id'], req.body);
  sendSuccess(res, preference, 'Dashboard preference updated successfully.');
});

module.exports = {
  getMetrics,
  getPreference,
  updatePreference,
};
