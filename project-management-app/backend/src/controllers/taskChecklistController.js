const {
  createTaskChecklist,
  deleteTaskChecklist,
  getTaskChecklists,
  updateTaskChecklist,
} = require('../services/taskChecklistService');
const { asyncHandler, sendSuccess } = require('../utils/responseUtils');

const getRequestActivityContext = (req) => ({
  actor_user_id: req.user?.id || null,
  ip_address: req.ip,
  user_agent: req.headers['user-agent'],
});

const listTaskChecklists = asyncHandler(async (req, res) => {
  const checklists = await getTaskChecklists(req.params.taskId);
  sendSuccess(res, checklists);
});

const createTaskChecklistController = asyncHandler(async (req, res) => {
  const checklist = await createTaskChecklist(req.params.taskId, req.body, getRequestActivityContext(req));
  sendSuccess(res, checklist, 'Checklist berhasil dibuat.', 201);
});

const updateTaskChecklistController = asyncHandler(async (req, res) => {
  const checklist = await updateTaskChecklist(req.params.id, req.body, getRequestActivityContext(req));
  sendSuccess(res, checklist, 'Checklist berhasil diperbarui.');
});

const deleteTaskChecklistController = asyncHandler(async (req, res) => {
  const checklist = await deleteTaskChecklist(req.params.id, getRequestActivityContext(req));
  sendSuccess(res, checklist, 'Checklist berhasil dihapus.');
});

module.exports = {
  createTaskChecklist: createTaskChecklistController,
  deleteTaskChecklist: deleteTaskChecklistController,
  listTaskChecklists,
  updateTaskChecklist: updateTaskChecklistController,
};
