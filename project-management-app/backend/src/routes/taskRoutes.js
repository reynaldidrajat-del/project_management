const express = require('express');
const taskController = require('../controllers/taskController');

const router = express.Router();

// Route untuk membaca daftar task, termasuk filter dan mode tree.
router.get('/', taskController.listTasks);
// Route untuk membaca subtask dari task tertentu.
router.get('/:id/subtasks', taskController.listSubtasks);
// Route untuk membaca detail satu task.
router.get('/:id', taskController.getTask);
// Route untuk membuat task baru.
router.post('/', taskController.createTask);
// Route untuk mengubah seluruh data utama task.
router.put('/:id', taskController.updateTask);
// Route untuk menghapus task.
router.delete('/:id', taskController.deleteTask);
// Route untuk mengubah status task saja.
router.patch('/:id/status', taskController.patchStatus);
// Route untuk mengubah progress task saja.
router.patch('/:id/progress', taskController.patchProgress);
// Route untuk approve task yang menunggu review lead.
router.patch('/:id/approve', taskController.patchApprove);
// Route untuk mencatat tanggal realisasi task.
router.patch('/:id/realization', taskController.patchRealization);
// Route untuk memindahkan task antar bucket/status/urutan.
router.patch('/:id/move', taskController.patchMove);
// Route untuk mengubah parent task.
router.patch('/:id/parent', taskController.patchParent);

module.exports = router;
