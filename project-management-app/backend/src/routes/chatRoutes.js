const express = require('express');
const chatController = require('../controllers/chatController');
const { requirePermission } = require('../middlewares/permissionMiddleware');

const router = express.Router();

// Route project chat/realtime collaboration untuk membaca dan mengirim pesan.
router.get('/rooms', requirePermission('chat', 'read'), chatController.listRooms);
router.post('/rooms', requirePermission('chat', 'create'), chatController.createRoom);
router.get('/rooms/:roomId/messages', requirePermission('chat', 'read'), chatController.listMessages);
router.post('/rooms/:roomId/messages', requirePermission('chat', 'create'), chatController.createMessage);
router.post('/rooms/:roomId/read', requirePermission('chat', 'read'), chatController.markRoomRead);
router.patch('/messages/:id', requirePermission('chat', 'update'), chatController.updateMessage);
router.delete('/messages/:id', requirePermission('chat', 'delete'), chatController.deleteMessage);
router.post('/messages/:id/read', requirePermission('chat', 'read'), chatController.markMessageRead);

module.exports = router;
