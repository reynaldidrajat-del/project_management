const express = require('express');

const taskChecklistController = require('../controllers/taskChecklistController');
const { requirePermission } = require('../middlewares/permissionMiddleware');

const router = express.Router();

router.put('/:id', requirePermission('task_checklist', 'update'), taskChecklistController.updateTaskChecklist);
router.delete('/:id', requirePermission('task_checklist', 'delete'), taskChecklistController.deleteTaskChecklist);

module.exports = router;
