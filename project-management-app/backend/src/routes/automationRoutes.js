const express = require('express');
const {
  createRule,
  deleteRule,
  disableRule,
  enableRule,
  getRule,
  listLogs,
  listRules,
  trigger,
  updateRule,
} = require('../controllers/automationController');
const { authenticateRequest } = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');

const router = express.Router();

router.use(authenticateRequest);

router.get('/rules', requirePermission('automation', 'read'), listRules);
router.post('/rules', requirePermission('automation', 'create'), createRule);
router.get('/rules/:id', requirePermission('automation', 'read'), getRule);
router.put('/rules/:id', requirePermission('automation', 'update'), updateRule);
router.patch('/rules/:id/enable', requirePermission('automation', 'update'), enableRule);
router.patch('/rules/:id/disable', requirePermission('automation', 'update'), disableRule);
router.delete('/rules/:id', requirePermission('automation', 'delete'), deleteRule);
router.get('/rules/:id/logs', requirePermission('automation', 'read'), listLogs);

router.get('/logs', requirePermission('automation', 'read'), listLogs);
router.post('/trigger', requirePermission('automation', 'execute'), trigger);

module.exports = router;
