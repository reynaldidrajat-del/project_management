const {
  getDepartmentPerformance,
  getPerformanceBottlenecks,
  getPerformanceExport,
  getPerformanceUsers,
  getUserPerformance,
} = require('../services/performanceService');
const { asyncHandler, sendSuccess } = require('../utils/responseUtils');

const listUsers = asyncHandler(async (req, res) => {
  const report = await getPerformanceUsers(req.query);
  sendSuccess(res, report);
});

const getUserDetail = asyncHandler(async (req, res) => {
  const report = await getUserPerformance(req.params.userId, req.query);
  sendSuccess(res, report);
});

const listDepartments = asyncHandler(async (req, res) => {
  const report = await getDepartmentPerformance(req.query);
  sendSuccess(res, report);
});

const listBottlenecks = asyncHandler(async (req, res) => {
  const report = await getPerformanceBottlenecks(req.query);
  sendSuccess(res, report);
});

const exportUsers = asyncHandler(async (req, res) => {
  const exportResult = await getPerformanceExport(req.query);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${exportResult.file_name}"`);
  res.status(200).send(exportResult.content);
});

module.exports = {
  exportUsers,
  getUserDetail,
  listBottlenecks,
  listDepartments,
  listUsers,
};
