const {
  approveTask,
  createTask,
  deleteTask,
  getProjectTasks,
  getSubtasks,
  getTaskById,
  getTasks,
  moveTask,
  updateTask,
  updateTaskParent,
  updateTaskProgress,
  updateTaskRealization,
  updateTaskStatus,
} = require('../services/taskService');
const { asyncHandler, sendError, sendSuccess } = require('../utils/responseUtils');

// Mengambil daftar task umum, bisa dalam bentuk flat atau tree.
const listTasks = asyncHandler(async (req, res) => {
  const tasks = await getTasks({
    ...req.query,
    tree: req.query.tree === 'true',
  });
  sendSuccess(res, tasks);
});

// Mengambil daftar task hanya untuk satu project.
const listProjectTasks = asyncHandler(async (req, res) => {
  const tasks = await getProjectTasks(req.params.projectId, {
    ...req.query,
    tree: req.query.tree === 'true',
  });
  sendSuccess(res, tasks);
});

// Mengambil detail satu task berdasarkan id.
const getTask = asyncHandler(async (req, res) => {
  const task = await getTaskById(req.params.id);

  if (!task) {
    return sendError(res, 'Task tidak ditemukan.', 'Task tidak ditemukan.', 404);
  }

  return sendSuccess(res, task);
});

// Mengambil semua subtask di bawah satu task.
const listSubtasks = asyncHandler(async (req, res) => {
  const subtasks = await getSubtasks(req.params.id);
  sendSuccess(res, subtasks);
});

// Membuat task baru dari payload frontend.
const createTaskController = asyncHandler(async (req, res) => {
  const task = await createTask(req.body);
  sendSuccess(res, task, 'Task berhasil dibuat.', 201);
});

// Mengubah data utama task.
const updateTaskController = asyncHandler(async (req, res) => {
  const task = await updateTask(req.params.id, req.body);
  sendSuccess(res, task, 'Task berhasil diperbarui.');
});

// Menghapus task beserta subtask turunannya sesuai aturan database.
const deleteTaskController = asyncHandler(async (req, res) => {
  const task = await deleteTask(req.params.id);
  sendSuccess(res, task, 'Task berhasil dihapus.');
});

// Mengubah status task tanpa mengirim seluruh data task.
const patchStatus = asyncHandler(async (req, res) => {
  const task = await updateTaskStatus(req.params.id, req.body.status);
  sendSuccess(res, task, 'Status task berhasil diperbarui.');
});

// Mengubah progress task tanpa mengirim seluruh data task.
const patchProgress = asyncHandler(async (req, res) => {
  const task = await updateTaskProgress(req.params.id, req.body.progress);
  sendSuccess(res, task, 'Progress task berhasil diperbarui.');
});

// Mengapprove task yang sudah masuk Waiting Review.
const patchApprove = asyncHandler(async (req, res) => {
  const approverUserId = req.body.approver_user_id || req.body.approved_by_user_id || req.headers['x-user-id'];
  const task = await approveTask(req.params.id, approverUserId);
  sendSuccess(res, task, 'Task berhasil diapprove.');
});

// Mencatat realisasi mulai/selesai/manual task.
const patchRealization = asyncHandler(async (req, res) => {
  const actorUserId = req.body.actor_user_id || req.body.user_id || req.headers['x-user-id'];
  const task = await updateTaskRealization(req.params.id, {
    ...req.body,
    actor_user_id: actorUserId,
  });
  sendSuccess(res, task, 'Realisasi task berhasil diperbarui.');
});

// Memindahkan task antar bucket/status/urutan dari board drag and drop.
const patchMove = asyncHandler(async (req, res) => {
  const task = await moveTask(req.params.id, req.body);
  sendSuccess(res, task, 'Task berhasil dipindahkan.');
});

// Mengubah hubungan parent-child task.
const patchParent = asyncHandler(async (req, res) => {
  const task = await updateTaskParent(req.params.id, req.body.parent_task_id);
  sendSuccess(res, task, 'Parent task berhasil diperbarui.');
});

module.exports = {
  patchApprove,
  createTask: createTaskController,
  deleteTask: deleteTaskController,
  getTask,
  listProjectTasks,
  listSubtasks,
  listTasks,
  patchMove,
  patchParent,
  patchProgress,
  patchRealization,
  patchStatus,
  updateTask: updateTaskController,
};
