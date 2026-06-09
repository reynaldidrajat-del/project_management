const express = require('express');
const {
  execute,
  executeAssigneeChange,
  executeDelete,
  executeSprintAssignment,
  executeStatusChange,
} = require('../controllers/bulkOperationsController');
const { requirePermission } = require('../middlewares/permissionMiddleware');

const router = express.Router();

router.post('/', requirePermission('bulk_operation', 'execute'), execute);
router.post('/issues', requirePermission('bulk_operation', 'execute'), execute);
router.post('/issues/assignee', requirePermission('bulk_operation', 'execute'), executeAssigneeChange);
router.post('/issues/delete', requirePermission('bulk_operation', 'execute'), executeDelete);
router.post('/issues/sprint', requirePermission('bulk_operation', 'execute'), executeSprintAssignment);
router.post('/issues/status', requirePermission('bulk_operation', 'execute'), executeStatusChange);

module.exports = router;
