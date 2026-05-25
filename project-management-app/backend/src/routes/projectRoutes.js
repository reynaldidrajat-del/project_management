const express = require('express');
const bucketController = require('../controllers/bucketController');
const projectController = require('../controllers/projectController');
const taskLabelController = require('../controllers/taskLabelController');
const taskController = require('../controllers/taskController');
const { requirePermission } = require('../middlewares/permissionMiddleware');

const router = express.Router();

// Route untuk membaca bucket yang dimiliki project tertentu.
router.get('/:projectId/buckets', bucketController.getBucketsByProject);
// Route untuk membaca task di dalam satu project.
router.get('/:projectId/tasks', taskController.listProjectTasks);
// Route untuk membaca label task di dalam satu project.
router.get('/:projectId/task-labels', taskLabelController.listTaskLabels);
// Route untuk membuat label task di dalam satu project.
router.post('/:projectId/task-labels', requirePermission('task_label', 'create'), taskLabelController.createTaskLabel);
// Route untuk membaca daftar project.
router.get('/', projectController.listProjects);
// Route untuk membaca detail satu project.
router.get('/:id', projectController.getProject);
// Route untuk membuat project baru.
router.post('/', requirePermission('project', 'create'), projectController.createProject);
// Route untuk mengubah data project.
router.put('/:id', requirePermission('project', 'update'), projectController.updateProject);
// Route untuk menghapus project.
router.delete('/:id', requirePermission('project', 'delete'), projectController.deleteProject);

module.exports = router;
