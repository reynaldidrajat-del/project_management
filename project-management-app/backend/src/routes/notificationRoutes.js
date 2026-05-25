const express = require('express');
const notificationController = require('../controllers/notificationController');
const { requirePermission } = require('../middlewares/permissionMiddleware');

const router = express.Router();

router.get('/', requirePermission('notification', 'read'), notificationController.list);
router.get('/unread-count', requirePermission('notification', 'read'), notificationController.unreadCount);
router.patch('/read-all', requirePermission('notification', 'update'), notificationController.markAllRead);
router.patch('/:id/read', requirePermission('notification', 'update'), notificationController.markRead);

module.exports = router;
