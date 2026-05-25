const {
  createTaskLabel,
  deleteTaskLabel,
  getTaskLabels,
  updateTaskLabel,
} = require('../services/taskLabelService');
const { asyncHandler, sendSuccess } = require('../utils/responseUtils');

const getRequestActivityContext = (req) => ({
  actor_user_id: req.user?.id || null,
  ip_address: req.ip,
  user_agent: req.headers['user-agent'],
});

const listTaskLabels = asyncHandler(async (req, res) => {
  const labels = await getTaskLabels({
    ...req.query,
    project_id: req.params.projectId || req.query.project_id,
  });
  sendSuccess(res, labels);
});

const createTaskLabelController = asyncHandler(async (req, res) => {
  const label = await createTaskLabel(
    {
      ...req.body,
      project_id: req.params.projectId || req.body.project_id,
    },
    getRequestActivityContext(req),
  );
  sendSuccess(res, label, 'Label task berhasil dibuat.', 201);
});

const updateTaskLabelController = asyncHandler(async (req, res) => {
  const label = await updateTaskLabel(req.params.id, req.body, getRequestActivityContext(req));
  sendSuccess(res, label, 'Label task berhasil diperbarui.');
});

const deleteTaskLabelController = asyncHandler(async (req, res) => {
  const label = await deleteTaskLabel(req.params.id, getRequestActivityContext(req));
  sendSuccess(res, label, 'Label task berhasil dihapus.');
});

module.exports = {
  createTaskLabel: createTaskLabelController,
  deleteTaskLabel: deleteTaskLabelController,
  listTaskLabels,
  updateTaskLabel: updateTaskLabelController,
};
