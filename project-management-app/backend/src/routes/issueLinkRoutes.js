const express = require('express');
const {
  createLink,
  deleteLink,
  deleteLinksForIssue,
  getLink,
  listLinks,
} = require('../controllers/issueLinkController');
const { authenticateRequest } = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');

const router = express.Router();

router.use(authenticateRequest);

router.get('/', requirePermission('issue_links', 'read'), listLinks);
router.post('/', requirePermission('issue_links', 'create'), createLink);

router.get('/issues/:issueId', requirePermission('issue_links', 'read'), listLinks);
router.delete('/issues/:issueId', requirePermission('issue_links', 'delete'), deleteLinksForIssue);

router.get('/:id', requirePermission('issue_links', 'read'), getLink);
router.delete('/:id', requirePermission('issue_links', 'delete'), deleteLink);

module.exports = router;
