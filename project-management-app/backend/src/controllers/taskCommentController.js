const {
  createTaskComment,
  deleteTaskComment,
  listTaskComments,
  markCommentRead,
  markTaskCommentsRead,
  updateTaskComment,
} = require('../services/commentService');
const { asyncHandler, sendSuccess } = require('../utils/responseUtils');

const getRequestContext = (req) => ({
  actor_user_id: req.user?.id || req.headers['x-user-id'] || null,
  actor_name: req.user?.name || null,
  actor_role: req.user?.role || null,
  ip_address: req.ip,
  user_agent: req.headers['user-agent'],
});

const listComments = asyncHandler(async (req, res) => {
  const comments = await listTaskComments(req.params.taskId);
  sendSuccess(res, comments);
});

const createComment = asyncHandler(async (req, res) => {
  const comment = await createTaskComment(req.params.taskId, req.body, getRequestContext(req));
  sendSuccess(res, comment, 'Komentar berhasil ditambahkan.', 201);
});

const updateComment = asyncHandler(async (req, res) => {
  const comment = await updateTaskComment(req.params.id, req.body, getRequestContext(req));
  sendSuccess(res, comment, 'Komentar berhasil diperbarui.');
});

const deleteComment = asyncHandler(async (req, res) => {
  const comment = await deleteTaskComment(req.params.id, getRequestContext(req));
  sendSuccess(res, comment, 'Komentar berhasil dihapus.');
});

const markTaskRead = asyncHandler(async (req, res) => {
  const result = await markTaskCommentsRead(req.params.taskId, req.user?.id || req.headers['x-user-id']);
  sendSuccess(res, result, 'Komentar task ditandai terbaca.');
});

const markRead = asyncHandler(async (req, res) => {
  const result = await markCommentRead(req.params.id, req.user?.id || req.headers['x-user-id']);
  sendSuccess(res, result, 'Komentar ditandai terbaca.');
});

module.exports = {
  createComment,
  deleteComment,
  listComments,
  markRead,
  markTaskRead,
  updateComment,
};
