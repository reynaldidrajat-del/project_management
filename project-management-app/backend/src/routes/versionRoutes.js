const express = require('express');
const {
  archiveVersion,
  assignIssueAffectsVersion,
  assignIssueFixVersion,
  createVersion,
  deleteVersion,
  getProgress,
  getVersion,
  listVersionIssues,
  listVersions,
  releaseVersion,
  removeIssueAffectsVersion,
  removeIssueFixVersion,
  updateVersion,
} = require('../controllers/versionController');
const { authenticateRequest } = require('../middlewares/authMiddleware');
const { checkPermission } = require('../middlewares/permissionMiddleware');

const router = express.Router();

router.use(authenticateRequest);

router.get('/', checkPermission('read_versions'), listVersions);
router.get('/project/:projectId', checkPermission('read_versions'), listVersions);

router.post('/', checkPermission('manage_versions'), createVersion);

router.post('/issues/:issueId/fix', checkPermission('manage_versions'), assignIssueFixVersion);
router.delete('/issues/:issueId/fix', checkPermission('manage_versions'), removeIssueFixVersion);
router.post('/issues/:issueId/affects', checkPermission('manage_versions'), assignIssueAffectsVersion);
router.delete('/issues/:issueId/affects', checkPermission('manage_versions'), removeIssueAffectsVersion);

router.get('/:id/progress', checkPermission('read_versions'), getProgress);
router.get('/:id/issues', checkPermission('read_versions'), listVersionIssues);
router.post('/:id/release', checkPermission('manage_versions'), releaseVersion);
router.post('/:id/archive', checkPermission('manage_versions'), archiveVersion);

router.get('/:id', checkPermission('read_versions'), getVersion);
router.put('/:id', checkPermission('manage_versions'), updateVersion);
router.delete('/:id', checkPermission('manage_versions'), deleteVersion);

module.exports = router;
