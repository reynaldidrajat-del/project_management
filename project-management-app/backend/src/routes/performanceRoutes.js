const express = require('express');
const performanceController = require('../controllers/performanceController');
const { requirePermission } = require('../middlewares/permissionMiddleware');

const router = express.Router();

// Route laporan kinerja otomatis dari data task, deadline, approval, dan progress.
router.get('/users', requirePermission('performance', 'read'), performanceController.listUsers);
router.get('/users/:userId', requirePermission('performance', 'read'), performanceController.getUserDetail);
router.get('/departments', requirePermission('performance', 'read'), performanceController.listDepartments);
router.get('/bottlenecks', requirePermission('performance', 'read'), performanceController.listBottlenecks);
router.get('/export', requirePermission('performance', 'read'), performanceController.exportUsers);

module.exports = router;
