const express = require('express');
const {
  createComponent,
  deleteComponent,
  getComponent,
  getMetrics,
  listIssueComponents,
  listProjectComponents,
  replaceIssueComponents,
  updateComponent,
} = require('../controllers/componentController');
const { authenticateRequest } = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');

const router = express.Router();

router.use(authenticateRequest);

router.get('/', requirePermission('component', 'read'), listProjectComponents);
router.post('/', requirePermission('component', 'create'), createComponent);

router.get('/project/:projectId', requirePermission('component', 'read'), listProjectComponents);
router.get('/issues/:issueId', requirePermission('component', 'read'), listIssueComponents);
router.put('/issues/:issueId', requirePermission('component', 'update'), replaceIssueComponents);
router.post('/issues/:issueId', requirePermission('component', 'update'), replaceIssueComponents);

router.get('/:id/metrics', requirePermission('component', 'read'), getMetrics);
router.get('/:id', requirePermission('component', 'read'), getComponent);
router.put('/:id', requirePermission('component', 'update'), updateComponent);
router.delete('/:id', requirePermission('component', 'delete'), deleteComponent);

module.exports = router;
