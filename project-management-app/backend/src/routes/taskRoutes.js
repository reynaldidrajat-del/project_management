const express = require('express');
const taskChecklistController = require('../controllers/taskChecklistController');
const taskCommentController = require('../controllers/taskCommentController');
const taskController = require('../controllers/taskController');
const { requirePermission } = require('../middlewares/permissionMiddleware');

const router = express.Router();

// Route untuk membaca daftar task, termasuk filter dan mode tree.
router.get('/', taskController.listTasks);
// Route untuk menjalankan bulk action pada beberapa task.
router.post('/bulk-update', requirePermission('task', 'update'), taskController.bulkUpdate);
// Route untuk membaca checklist milik satu task.
router.get('/:taskId/checklists', taskChecklistController.listTaskChecklists);
// Route untuk membuat checklist di dalam satu task.
router.post('/:taskId/checklists', requirePermission('task_checklist', 'create'), taskChecklistController.createTaskChecklist);
// Route untuk membaca komentar milik satu task.
router.get('/:taskId/comments', requirePermission('task_comment', 'read'), taskCommentController.listComments);
// Route untuk menambahkan komentar di dalam satu task.
router.post('/:taskId/comments', requirePermission('task_comment', 'create'), taskCommentController.createComment);
// Route untuk menandai seluruh komentar task sudah dibaca user login.
router.post('/:taskId/comments/read', requirePermission('task_comment', 'read'), taskCommentController.markTaskRead);
// Route untuk membaca subtask dari task tertentu.
router.get('/:id/subtasks', taskController.listSubtasks);
// Route untuk membaca detail satu task.
router.get('/:id', taskController.getTask);
// Route untuk membuat task baru.
router.post('/', requirePermission('task', 'create'), taskController.createTask);
// Route untuk mengubah seluruh data utama task.
router.put('/:id', requirePermission('task', 'update'), taskController.updateTask);
// Route untuk menghapus task.
router.delete('/:id', requirePermission('task', 'delete'), taskController.deleteTask);
// Route untuk mengubah status task saja.
router.patch('/:id/status', requirePermission('task', 'update'), taskController.patchStatus);
// Route untuk mengubah progress task saja.
router.patch('/:id/progress', requirePermission('task', 'progress'), taskController.patchProgress);
// Route untuk approve task yang menunggu review lead.
router.patch('/:id/approve', requirePermission('task', 'approve'), taskController.patchApprove);
// Route untuk mencatat tanggal realisasi task.
router.patch('/:id/realization', requirePermission('task', 'realization'), taskController.patchRealization);
// Route untuk memindahkan task antar bucket/status/urutan.
router.patch('/:id/move', requirePermission('task', 'move'), taskController.patchMove);
// Route untuk mengubah parent task.
router.patch('/:id/parent', requirePermission('task', 'update'), taskController.patchParent);

module.exports = router;
