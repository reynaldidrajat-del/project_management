const { getDashboardSummary } = require('../services/dashboardService');
const { asyncHandler, sendSuccess } = require('../utils/responseUtils');

// Mengambil ringkasan dashboard agar halaman utama punya angka monitoring.
const getSummary = asyncHandler(async (req, res) => {
  const summary = await getDashboardSummary({ user: req.user });
  sendSuccess(res, summary);
});

module.exports = {
  getSummary,
};
