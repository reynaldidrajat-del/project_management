const { listActivities } = require('../services/activityService');
const { asyncHandler, sendSuccess } = require('../utils/responseUtils');

// Mengambil audit trail global atau terfilter project/task/user.
const listActivityLogs = asyncHandler(async (req, res) => {
  const activities = await listActivities(req.query);
  sendSuccess(res, activities);
});

module.exports = {
  listActivityLogs,
};
