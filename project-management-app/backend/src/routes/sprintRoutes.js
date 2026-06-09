const express = require('express');
const {
  addSprintIssues,
  completeSprint,
  createSprint,
  deleteSprint,
  getActiveProjectSprint,
  getSprint,
  getSprintMetrics,
  listSprintIssues,
  listSprints,
  removeSprintIssues,
  startSprint,
  updateSprint,
} = require('../controllers/sprintController');
const { authenticateRequest } = require('../middlewares/authMiddleware');
const { checkPermission } = require('../middlewares/permissionMiddleware');

const router = express.Router();

router.use(authenticateRequest);

router.get('/', checkPermission('read_sprints'), listSprints);
router.get('/active', checkPermission('read_sprints'), getActiveProjectSprint);
router.get('/project/:projectId', checkPermission('read_sprints'), listSprints);
router.get('/project/:projectId/active', checkPermission('read_sprints'), getActiveProjectSprint);

router.post('/', checkPermission('manage_sprints'), createSprint);
router.get('/:id', checkPermission('read_sprints'), getSprint);
router.put('/:id', checkPermission('manage_sprints'), updateSprint);
router.delete('/:id', checkPermission('manage_sprints'), deleteSprint);

router.post('/:id/start', checkPermission('manage_sprints'), startSprint);
router.post('/:id/complete', checkPermission('manage_sprints'), completeSprint);

router.get('/:id/issues', checkPermission('read_sprints'), listSprintIssues);
router.post('/:id/issues', checkPermission('manage_sprints'), addSprintIssues);
router.delete('/:id/issues', checkPermission('manage_sprints'), removeSprintIssues);
router.post('/:id/issues/remove', checkPermission('manage_sprints'), removeSprintIssues);

router.get('/:id/metrics', checkPermission('read_sprints'), getSprintMetrics);

module.exports = router;
