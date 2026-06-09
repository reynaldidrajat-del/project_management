const express = require('express');
const {
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
} = require('../controllers/reportController');
const { authenticateRequest } = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');

const router = express.Router();

router.use(authenticateRequest);

router.get('/', requirePermission('report', 'read'), list);
router.post('/', requirePermission('report', 'create'), create);
router.post('/generate', requirePermission('report', 'read'), generate);
router.post('/export', requirePermission('report', 'export'), exportGenerated);
router.get('/:id', requirePermission('report', 'read'), get);
router.put('/:id', requirePermission('report', 'update'), update);
router.delete('/:id', requirePermission('report', 'delete'), remove);
router.post('/:id/run', requirePermission('report', 'read'), runSaved);
router.post('/:id/export', requirePermission('report', 'export'), exportSaved);
router.put('/:id/schedule', requirePermission('report', 'schedule'), schedule);

module.exports = router;
