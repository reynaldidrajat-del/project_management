const express = require('express');
const taskCommentController = require('../controllers/taskCommentController');
const { requirePermission } = require('../middlewares/permissionMiddleware');

const router = express.Router();

router.put('/:id', requirePermission('task_comment', 'update'), taskCommentController.updateComment);
router.delete('/:id', requirePermission('task_comment', 'delete'), taskCommentController.deleteComment);
router.post('/:id/read', requirePermission('task_comment', 'read'), taskCommentController.markRead);

module.exports = router;
