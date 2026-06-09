const express = require('express');
const {
  getStats,
  listBacklog,
  moveIssuesToBacklog,
  moveIssuesToSprint,
  reorder,
} = require('../controllers/backlogController');
const { authenticateRequest } = require('../middlewares/authMiddleware');
const { checkPermission } = require('../middlewares/permissionMiddleware');

const router = express.Router();

router.use(authenticateRequest);

router.get('/', checkPermission('read_backlog'), listBacklog);
router.get('/stats', checkPermission('read_backlog'), getStats);
router.get('/project/:projectId', checkPermission('read_backlog'), listBacklog);
router.get('/project/:projectId/stats', checkPermission('read_backlog'), getStats);

router.patch('/reorder', checkPermission('manage_backlog'), reorder);
router.patch('/project/:projectId/issues/:issueId/reorder', checkPermission('manage_backlog'), reorder);
router.post('/move-to-sprint', checkPermission('manage_backlog'), moveIssuesToSprint);
router.post('/move-to-backlog', checkPermission('manage_backlog'), moveIssuesToBacklog);
router.post('/sprints/:sprintId/issues', checkPermission('manage_backlog'), moveIssuesToSprint);

module.exports = router;
