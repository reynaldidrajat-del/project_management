const {
  addIssueWatcher,
  addIssueWatchers,
  cleanupWatchersForProjectUser,
  listIssueWatchers,
  removeIssueWatcher,
} = require('../services/watcherService');
const { asyncHandler, sendError, sendSuccess } = require('../utils/responseUtils');

const getRequestActivityContext = (req) => ({
  actor_user_id: req.user?.id || req.headers['x-user-id'] || null,
  ip_address: req.ip,
  user_agent: req.headers['user-agent'],
});

const listWatchers = asyncHandler(async (req, res) => {
  const watchers = await listIssueWatchers(req.params.issueId);
  sendSuccess(res, watchers);
});

const addWatcher = asyncHandler(async (req, res) => {
  const userId = req.body.user_id || req.body.userId || req.user?.id;

  if (!userId) {
    return sendError(res, 'User ID is required.', 'Validation failed.', 400);
  }

  const result = await addIssueWatcher(req.params.issueId, userId, {
    ...getRequestActivityContext(req),
    auto_watched: Boolean(req.body.auto_watched || req.body.autoWatched),
  });

  return sendSuccess(res, result, 'Watcher added successfully.', 201);
});

const addWatchers = asyncHandler(async (req, res) => {
  const userIds = req.body.user_ids || req.body.userIds || [];
  const result = await addIssueWatchers(req.params.issueId, userIds, {
    ...getRequestActivityContext(req),
    auto_watched: Boolean(req.body.auto_watched || req.body.autoWatched),
  });

  sendSuccess(res, result, 'Watchers added successfully.', 201);
});

const removeWatcher = asyncHandler(async (req, res) => {
  const userId = req.params.userId || req.body.user_id || req.body.userId || req.user?.id;
  const result = await removeIssueWatcher(req.params.issueId, userId, getRequestActivityContext(req));
  sendSuccess(res, result, 'Watcher removed successfully.');
});

const cleanupProjectUserWatchers = asyncHandler(async (req, res) => {
  const result = await cleanupWatchersForProjectUser(req.params.projectId, req.params.userId);
  sendSuccess(res, result, 'Project user watchers cleaned up successfully.');
});

module.exports = {
  addWatcher,
  addWatchers,
  cleanupProjectUserWatchers,
  listWatchers,
  removeWatcher,
};
