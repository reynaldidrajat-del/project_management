const {
  createReport,
  deleteReport,
  exportReportData,
  generateReport,
  generateSavedReport,
  getReportById,
  listReports,
  scheduleReport,
  updateReport,
} = require('../services/reportService');
const { asyncHandler, sendError, sendSuccess } = require('../utils/responseUtils');

const getRequestActivityContext = (req) => ({
  actor_user_id: req.user?.id || req.headers['x-user-id'] || null,
  ip_address: req.ip,
  user_agent: req.headers['user-agent'],
});

const list = asyncHandler(async (req, res) => {
  const reports = await listReports(req.query);
  sendSuccess(res, reports);
});

const get = asyncHandler(async (req, res) => {
  const report = await getReportById(req.params.id);

  if (!report) {
    return sendError(res, 'Report not found.', 'Report not found.', 404);
  }

  return sendSuccess(res, report);
});

const create = asyncHandler(async (req, res) => {
  const report = await createReport(req.body, getRequestActivityContext(req));
  sendSuccess(res, report, 'Report created successfully.', 201);
});

const update = asyncHandler(async (req, res) => {
  const report = await updateReport(req.params.id, req.body, getRequestActivityContext(req));
  sendSuccess(res, report, 'Report updated successfully.');
});

const remove = asyncHandler(async (req, res) => {
  const result = await deleteReport(req.params.id, getRequestActivityContext(req));
  sendSuccess(res, result, 'Report deleted successfully.');
});

const generate = asyncHandler(async (req, res) => {
  const data = await generateReport(req.body.type || req.query.type, {
    ...req.query,
    ...(req.body.config || req.body),
  });
  sendSuccess(res, data);
});

const runSaved = asyncHandler(async (req, res) => {
  const result = await generateSavedReport(req.params.id, {
    ...req.query,
    ...(req.body.config || req.body),
  });
  sendSuccess(res, result);
});

const exportGenerated = asyncHandler(async (req, res) => {
  const type = req.body.type || req.query.type;
  const format = req.body.format || req.query.format || 'csv';
  const data = await generateReport(type, {
    ...req.query,
    ...(req.body.config || req.body),
  });
  const exported = await exportReportData(type, data, format);

  res.setHeader('Content-Type', exported.content_type);
  res.setHeader('Content-Disposition', `attachment; filename="${type}.${exported.extension}"`);
  res.send(exported.body);
});

const exportSaved = asyncHandler(async (req, res) => {
  const format = req.body.format || req.query.format || 'csv';
  const result = await generateSavedReport(req.params.id, {
    ...req.query,
    ...(req.body.config || req.body),
  });
  const exported = await exportReportData(result.report.name, result.data, format);

  res.setHeader('Content-Type', exported.content_type);
  res.setHeader('Content-Disposition', `attachment; filename="${result.report.name}.${exported.extension}"`);
  res.send(exported.body);
});

const schedule = asyncHandler(async (req, res) => {
  const result = await scheduleReport(req.params.id, req.body, getRequestActivityContext(req));
  sendSuccess(res, result, 'Report schedule updated successfully.');
});

module.exports = {
  create,
  exportGenerated,
  exportSaved,
  generate,
  get,
  list,
  remove,
  runSaved,
  schedule,
  update,
};
