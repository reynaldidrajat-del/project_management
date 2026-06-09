const express = require('express');
const {
  getMetrics,
  getPreference,
  updatePreference,
} = require('../controllers/dashboardMetricsController');
const { authenticateRequest } = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');

const router = express.Router();

router.use(authenticateRequest);

router.get('/', requirePermission('dashboard_metrics', 'read'), getMetrics);
router.get('/preferences', requirePermission('dashboard_metrics', 'read'), getPreference);
router.put('/preferences', requirePermission('dashboard_metrics', 'update'), updatePreference);

module.exports = router;
