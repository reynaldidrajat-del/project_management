const express = require('express');
const {
  assignToProject,
  create,
  get,
  getDefault,
  getProjectScheme,
  list,
  remove,
  update,
} = require('../controllers/prioritySchemeController');
const { authenticateRequest } = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');

const router = express.Router();

router.use(authenticateRequest);

router.get('/', requirePermission('priority_scheme', 'read'), list);
router.get('/default', requirePermission('priority_scheme', 'read'), getDefault);
router.get('/projects/:projectId', requirePermission('priority_scheme', 'read'), getProjectScheme);
router.put('/projects/:projectId', requirePermission('priority_scheme', 'assign'), assignToProject);
router.post('/', requirePermission('priority_scheme', 'create'), create);
router.get('/:id', requirePermission('priority_scheme', 'read'), get);
router.put('/:id', requirePermission('priority_scheme', 'update'), update);
router.delete('/:id', requirePermission('priority_scheme', 'delete'), remove);

module.exports = router;
