const {
  assignPrioritySchemeToProject,
  createPriorityScheme,
  deletePriorityScheme,
  getDefaultPriorityScheme,
  getPrioritySchemeById,
  getProjectPriorityScheme,
  listPrioritySchemes,
  updatePriorityScheme,
} = require('../services/prioritySchemeService');
const { asyncHandler, sendError, sendSuccess } = require('../utils/responseUtils');

const getRequestActivityContext = (req) => ({
  actor_user_id: req.user?.id || req.headers['x-user-id'] || null,
  ip_address: req.ip,
  user_agent: req.headers['user-agent'],
});

const list = asyncHandler(async (_req, res) => {
  const schemes = await listPrioritySchemes();
  sendSuccess(res, schemes);
});

const get = asyncHandler(async (req, res) => {
  const scheme = await getPrioritySchemeById(req.params.id);

  if (!scheme) {
    return sendError(res, 'Priority scheme not found.', 'Priority scheme not found.', 404);
  }

  return sendSuccess(res, scheme);
});

const getDefault = asyncHandler(async (_req, res) => {
  const scheme = await getDefaultPriorityScheme();
  sendSuccess(res, scheme);
});

const getProjectScheme = asyncHandler(async (req, res) => {
  const scheme = await getProjectPriorityScheme(req.params.projectId);
  sendSuccess(res, scheme);
});

const create = asyncHandler(async (req, res) => {
  const scheme = await createPriorityScheme(req.body, getRequestActivityContext(req));
  sendSuccess(res, scheme, 'Priority scheme created successfully.', 201);
});

const update = asyncHandler(async (req, res) => {
  const scheme = await updatePriorityScheme(req.params.id, req.body, getRequestActivityContext(req));
  sendSuccess(res, scheme, 'Priority scheme updated successfully.');
});

const remove = asyncHandler(async (req, res) => {
  const result = await deletePriorityScheme(req.params.id, getRequestActivityContext(req));
  sendSuccess(res, result, 'Priority scheme deleted successfully.');
});

const assignToProject = asyncHandler(async (req, res) => {
  const assignment = await assignPrioritySchemeToProject(
    req.params.projectId,
    req.body.scheme_id || req.body.schemeId,
    getRequestActivityContext(req),
  );
  sendSuccess(res, assignment, 'Priority scheme assigned successfully.');
});

module.exports = {
  assignToProject,
  create,
  get,
  getDefault,
  getProjectScheme,
  list,
  remove,
  update,
};
