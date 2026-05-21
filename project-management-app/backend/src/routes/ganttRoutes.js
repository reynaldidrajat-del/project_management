const express = require('express');
const ganttController = require('../controllers/ganttController');

const router = express.Router();

// Route untuk mengambil semua task yang akan digambar di Gantt global.
router.get('/tasks', ganttController.getAllGantt);
// Route untuk mengambil Gantt khusus satu project.
router.get('/projects/:projectId', ganttController.getProjectGantt);
// Route untuk mengambil Gantt gabungan berdasarkan department.
router.get('/departments/:departmentId', ganttController.getDepartmentGantt);

module.exports = router;
