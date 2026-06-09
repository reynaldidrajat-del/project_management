const express = require('express');
const { getSprintBurndown } = require('../controllers/burndownController');
const { authenticateRequest } = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');

const router = express.Router();

router.use(authenticateRequest);

router.get('/sprints/:sprintId', requirePermission('report', 'read'), getSprintBurndown);

module.exports = router;
