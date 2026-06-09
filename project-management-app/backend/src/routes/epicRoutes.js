const express = require('express');
const {
  createEpic,
  deleteEpic,
  getEpic,
  getEpicProgress,
  linkEpicIssue,
  listEpicIssues,
  listEpics,
  unlinkEpicIssue,
  updateEpic,
} = require('../controllers/epicController');
const { authenticateRequest } = require('../middlewares/authMiddleware');
const { checkPermission } = require('../middlewares/permissionMiddleware');

const router = express.Router();

router.use(authenticateRequest);

router.get('/', checkPermission('read_epics'), listEpics);
router.get('/project/:projectId', checkPermission('read_epics'), listEpics);
router.post('/', checkPermission('manage_epics'), createEpic);

router.delete('/issues/:issueId', checkPermission('manage_epics'), unlinkEpicIssue);

router.get('/:id/progress', checkPermission('read_epics'), getEpicProgress);
router.get('/:id/issues', checkPermission('read_epics'), listEpicIssues);
router.post('/:id/issues', checkPermission('manage_epics'), linkEpicIssue);
router.delete('/:id/issues/:issueId', checkPermission('manage_epics'), unlinkEpicIssue);

router.get('/:id', checkPermission('read_epics'), getEpic);
router.put('/:id', checkPermission('manage_epics'), updateEpic);
router.delete('/:id', checkPermission('manage_epics'), deleteEpic);

module.exports = router;
