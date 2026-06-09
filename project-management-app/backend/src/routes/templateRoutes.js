const express = require('express');
const {
  apply,
  create,
  get,
  list,
  preview,
  remove,
  update,
} = require('../controllers/templateController');
const { authenticateRequest } = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');

const router = express.Router();

router.use(authenticateRequest);

router.get('/', requirePermission('issue_template', 'read'), list);
router.post('/', requirePermission('issue_template', 'create'), create);
router.get('/:id', requirePermission('issue_template', 'read'), get);
router.put('/:id', requirePermission('issue_template', 'update'), update);
router.delete('/:id', requirePermission('issue_template', 'delete'), remove);
router.post('/:id/preview', requirePermission('issue_template', 'read'), preview);
router.post('/:id/apply', requirePermission('issue_template', 'apply'), apply);

module.exports = router;
