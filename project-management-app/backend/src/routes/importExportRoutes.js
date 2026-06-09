const express = require('express');
const {
  executeImport,
  exportIssues,
  previewImport,
} = require('../controllers/importExportController');
const { requirePermission } = require('../middlewares/permissionMiddleware');

const router = express.Router();

router.post('/import/preview', requirePermission('import_export', 'import'), previewImport);
router.post('/import', requirePermission('import_export', 'import'), executeImport);
router.get('/export', requirePermission('import_export', 'export'), exportIssues);
router.post('/export', requirePermission('import_export', 'export'), exportIssues);

module.exports = router;
