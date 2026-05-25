const express = require('express');

const taskLabelController = require('../controllers/taskLabelController');
const { requirePermission } = require('../middlewares/permissionMiddleware');

const router = express.Router();

router.get('/', taskLabelController.listTaskLabels);
router.post('/', requirePermission('task_label', 'create'), taskLabelController.createTaskLabel);
router.put('/:id', requirePermission('task_label', 'update'), taskLabelController.updateTaskLabel);
router.delete('/:id', requirePermission('task_label', 'delete'), taskLabelController.deleteTaskLabel);

module.exports = router;
