const { getBurndownData } = require('../services/burndownService');
const { asyncHandler, sendSuccess } = require('../utils/responseUtils');

const getSprintBurndown = asyncHandler(async (req, res) => {
  const burndown = await getBurndownData(req.params.sprintId, req.query);
  sendSuccess(res, burndown);
});

module.exports = {
  getSprintBurndown,
};
