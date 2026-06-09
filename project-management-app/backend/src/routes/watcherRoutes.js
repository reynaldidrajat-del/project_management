const express = require('express');
const {
  addWatcher,
  addWatchers,
  cleanupProjectUserWatchers,
  listWatchers,
  removeWatcher,
} = require('../controllers/watcherController');
const { authenticateRequest } = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');

const router = express.Router();

router.use(authenticateRequest);

router.get('/issues/:issueId', requirePermission('issue_watcher', 'read'), listWatchers);
router.post('/issues/:issueId', requirePermission('issue_watcher', 'create'), addWatcher);
router.post('/issues/:issueId/bulk', requirePermission('issue_watcher', 'create'), addWatchers);
router.delete('/issues/:issueId', requirePermission('issue_watcher', 'delete'), removeWatcher);
router.delete('/issues/:issueId/users/:userId', requirePermission('issue_watcher', 'delete'), removeWatcher);
router.delete('/projects/:projectId/users/:userId', requirePermission('issue_watcher', 'delete'), cleanupProjectUserWatchers);

module.exports = router;
