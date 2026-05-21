const express = require('express');
const bucketController = require('../controllers/bucketController');
const projectController = require('../controllers/projectController');
const taskController = require('../controllers/taskController');

const router = express.Router();

// Route untuk membaca bucket yang dimiliki project tertentu.
router.get('/:projectId/buckets', bucketController.getBucketsByProject);
// Route untuk membaca task di dalam satu project.
router.get('/:projectId/tasks', taskController.listProjectTasks);
// Route untuk membaca daftar project.
router.get('/', projectController.listProjects);
// Route untuk membaca detail satu project.
router.get('/:id', projectController.getProject);
// Route untuk membuat project baru.
router.post('/', projectController.createProject);
// Route untuk mengubah data project.
router.put('/:id', projectController.updateProject);
// Route untuk menghapus project.
router.delete('/:id', projectController.deleteProject);

module.exports = router;
