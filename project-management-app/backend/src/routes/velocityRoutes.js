const express = require('express');
const {
  getProjectSummary,
  getSprint,
  listProjectHistory,
  syncProjectHistory,
  syncSprint,
} = require('../controllers/velocityController');
const { authenticateRequest } = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');

const router = express.Router();

router.use(authenticateRequest);

router.get('/projects/:projectId', requirePermission('report', 'read'), getProjectSummary);
router.get('/projects/:projectId/history', requirePermission('report', 'read'), listProjectHistory);
router.post('/projects/:projectId/sync', requirePermission('report', 'update'), syncProjectHistory);
router.get('/sprints/:sprintId', requirePermission('report', 'read'), getSprint);
router.post('/sprints/:sprintId/sync', requirePermission('report', 'update'), syncSprint);

module.exports = router;
