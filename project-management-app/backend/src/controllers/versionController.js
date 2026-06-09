const {
  archiveVersion,
  assignAffectsVersion,
  assignFixVersion,
  createVersion,
  deleteVersion,
  getIssuesByVersion,
  getVersionById,
  getVersionProgress,
  getVersions,
  releaseVersion,
  removeAffectsVersion,
  removeFixVersion,
  updateVersion,
} = require('../services/versionService');
const { asyncHandler, sendError, sendSuccess } = require('../utils/responseUtils');

const getRequestActivityContext = (req) => ({
  actor_user_id: req.user?.id || req.headers['x-user-id'] || null,
  ip_address: req.ip,
  user_agent: req.headers['user-agent'],
});

const getProjectId = (req) => req.params.projectId || req.query.projectId || req.query.project_id;

const getVersionName = (req) => req.body.version_name || req.body.versionName || req.body.name;

const listVersions = asyncHandler(async (req, res) => {
  const projectId = getProjectId(req);

  if (!projectId) {
    return sendError(res, 'Project ID is required.', 'Validation failed.', 400);
  }

  const versions = await getVersions(projectId, req.query.status || null);
  return sendSuccess(res, versions);
});

const getVersion = asyncHandler(async (req, res) => {
  const version = await getVersionById(req.params.id);

  if (!version) {
    return sendError(res, 'Version not found.', 'Version not found.', 404);
  }

  return sendSuccess(res, version);
});

const createVersionController = asyncHandler(async (req, res) => {
  const version = await createVersion(req.body, getRequestActivityContext(req));
  sendSuccess(res, version, 'Version created successfully.', 201);
});

const updateVersionController = asyncHandler(async (req, res) => {
  const version = await updateVersion(req.params.id, req.body, getRequestActivityContext(req));
  sendSuccess(res, version, 'Version updated successfully.');
});

const deleteVersionController = asyncHandler(async (req, res) => {
  const version = await deleteVersion(req.params.id, getRequestActivityContext(req));
  sendSuccess(res, version, 'Version deleted successfully.');
});

const releaseVersionController = asyncHandler(async (req, res) => {
  const version = await releaseVersion(req.params.id, getRequestActivityContext(req));
  sendSuccess(res, version, 'Version released successfully.');
});

const archiveVersionController = asyncHandler(async (req, res) => {
  const version = await archiveVersion(req.params.id, getRequestActivityContext(req));
  sendSuccess(res, version, 'Version archived successfully.');
});

const getProgress = asyncHandler(async (req, res) => {
  const progress = await getVersionProgress(req.params.id);
  sendSuccess(res, progress);
});

const listVersionIssues = asyncHandler(async (req, res) => {
  const type = req.query.type === 'affects' ? 'affects' : 'fix';
  const issues = await getIssuesByVersion(req.params.id, type);
  sendSuccess(res, issues);
});

const assignIssueFixVersion = asyncHandler(async (req, res) => {
  const versionName = getVersionName(req);

  if (!versionName) {
    return sendError(res, 'Version name is required.', 'Validation failed.', 400);
  }

  const result = await assignFixVersion(req.params.issueId, versionName);
  return sendSuccess(res, result, 'Fix version assigned successfully.');
});

const assignIssueAffectsVersion = asyncHandler(async (req, res) => {
  const versionName = getVersionName(req);

  if (!versionName) {
    return sendError(res, 'Version name is required.', 'Validation failed.', 400);
  }

  const result = await assignAffectsVersion(req.params.issueId, versionName);
  return sendSuccess(res, result, 'Affects version assigned successfully.');
});

const removeIssueFixVersion = asyncHandler(async (req, res) => {
  const versionName = getVersionName(req);

  if (!versionName) {
    return sendError(res, 'Version name is required.', 'Validation failed.', 400);
  }

  const result = await removeFixVersion(req.params.issueId, versionName);
  return sendSuccess(res, result, 'Fix version removed successfully.');
});

const removeIssueAffectsVersion = asyncHandler(async (req, res) => {
  const versionName = getVersionName(req);

  if (!versionName) {
    return sendError(res, 'Version name is required.', 'Validation failed.', 400);
  }

  const result = await removeAffectsVersion(req.params.issueId, versionName);
  return sendSuccess(res, result, 'Affects version removed successfully.');
});

module.exports = {
  archiveVersion: archiveVersionController,
  assignIssueAffectsVersion,
  assignIssueFixVersion,
  createVersion: createVersionController,
  deleteVersion: deleteVersionController,
  getProgress,
  getVersion,
  listVersionIssues,
  listVersions,
  releaseVersion: releaseVersionController,
  removeIssueAffectsVersion,
  removeIssueFixVersion,
  updateVersion: updateVersionController,
};
