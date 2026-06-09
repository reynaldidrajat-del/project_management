const express = require('express');
const {
  convertIssue,
  createIssueSubtask,
  getHierarchy,
} = require('../controllers/hierarchyController');
const { authenticateRequest } = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');

const router = express.Router();

router.use(authenticateRequest);

router.get('/issues/:issueId', requirePermission('issue_hierarchy', 'read'), getHierarchy);
router.post('/issues/:issueId/subtasks', requirePermission('issue_hierarchy', 'create'), createIssueSubtask);
router.patch('/issues/:issueId/convert', requirePermission('issue_hierarchy', 'update'), convertIssue);

module.exports = router;
