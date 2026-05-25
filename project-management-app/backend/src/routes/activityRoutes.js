const express = require('express');

const activityController = require('../controllers/activityController');
const { requirePermission } = require('../middlewares/permissionMiddleware');

const router = express.Router();

// Route untuk membaca activity feed/audit trail aplikasi.
router.get('/', requirePermission('activity', 'read'), activityController.listActivityLogs);

module.exports = router;
