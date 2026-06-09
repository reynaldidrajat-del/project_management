const {
  createSavedFilter,
  deleteSavedFilter,
  executeSavedFilter,
  getSavedFilterById,
  listSavedFilters,
  searchIssues,
  updateSavedFilter,
  validateJql,
} = require('../services/jqlService');
const { asyncHandler, sendError, sendSuccess } = require('../utils/responseUtils');

const getRequestActivityContext = (req) => ({
  actor_user_id: req.user?.id || req.headers['x-user-id'] || null,
  ip_address: req.ip,
  user_agent: req.headers['user-agent'],
});

const getJqlFromRequest = (req) => req.body?.jql || req.body?.jql_query || req.query?.jql || req.query?.jql_query || '';

const search = asyncHandler(async (req, res) => {
  const result = await searchIssues(getJqlFromRequest(req), {
    actor_user_id: req.user?.id || req.headers['x-user-id'] || null,
    limit: req.body?.limit || req.query.limit,
    offset: req.body?.offset || req.query.offset,
    only_member_projects: req.body?.only_member_projects || req.query.only_member_projects,
    project_id: req.body?.project_id || req.query.project_id,
  });

  sendSuccess(res, result);
});

const validate = asyncHandler(async (req, res) => {
  validateJql(getJqlFromRequest(req));
  sendSuccess(res, { valid: true }, 'JQL syntax is valid.');
});

const listFilters = asyncHandler(async (req, res) => {
  const filters = await listSavedFilters(req.user?.id || req.headers['x-user-id'], req.query);
  sendSuccess(res, filters);
});

const getFilter = asyncHandler(async (req, res) => {
  const filter = await getSavedFilterById(req.params.id);

  if (!filter) {
    return sendError(res, 'Saved filter not found.', 'Saved filter not found.', 404);
  }

  return sendSuccess(res, filter);
});

const createFilter = asyncHandler(async (req, res) => {
  const filter = await createSavedFilter(req.body, getRequestActivityContext(req));
  sendSuccess(res, filter, 'Saved filter created successfully.', 201);
});

const updateFilter = asyncHandler(async (req, res) => {
  const filter = await updateSavedFilter(req.params.id, req.body, getRequestActivityContext(req));
  sendSuccess(res, filter, 'Saved filter updated successfully.');
});

const deleteFilter = asyncHandler(async (req, res) => {
  const result = await deleteSavedFilter(req.params.id, getRequestActivityContext(req));
  sendSuccess(res, result, 'Saved filter deleted successfully.');
});

const runFilter = asyncHandler(async (req, res) => {
  const result = await executeSavedFilter(req.params.id, {
    actor_user_id: req.user?.id || req.headers['x-user-id'] || null,
    limit: req.body?.limit || req.query.limit,
    offset: req.body?.offset || req.query.offset,
    only_member_projects: req.body?.only_member_projects || req.query.only_member_projects,
    project_id: req.body?.project_id || req.query.project_id,
  });

  sendSuccess(res, result);
});

const favoriteFilter = asyncHandler(async (req, res) => {
  const filter = await updateSavedFilter(
    req.params.id,
    { is_favorite: req.body?.is_favorite ?? req.body?.isFavorite ?? true },
    getRequestActivityContext(req),
  );

  sendSuccess(res, filter, 'Saved filter favorite status updated successfully.');
});

module.exports = {
  createFilter,
  deleteFilter,
  favoriteFilter,
  getFilter,
  listFilters,
  runFilter,
  search,
  updateFilter,
  validate,
};
