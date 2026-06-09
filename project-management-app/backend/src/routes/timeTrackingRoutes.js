const express = require('express');
const {
  createLog,
  deleteLog,
  getIssueSummary,
  getLog,
  getReport,
  listLogs,
  updateEstimates,
} = require('../controllers/timeTrackingController');
const { authenticateRequest } = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');

const router = express.Router();

router.use(authenticateRequest);

router.get('/logs', requirePermission('time_log', 'read'), listLogs);
router.get('/logs/:id', requirePermission('time_log', 'read'), getLog);
router.delete('/logs/:id', requirePermission('time_log', 'delete'), deleteLog);

router.get('/issues/:issueId', requirePermission('time_log', 'read'), getIssueSummary);
router.put('/issues/:issueId/estimates', requirePermission('time_log', 'update'), updateEstimates);
router.post('/issues/:issueId/logs', requirePermission('time_log', 'create'), createLog);

router.get('/reports', requirePermission('time_log', 'read'), getReport);

module.exports = router;
