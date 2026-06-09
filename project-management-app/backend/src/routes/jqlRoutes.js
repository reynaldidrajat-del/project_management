const express = require('express');
const {
  createFilter,
  deleteFilter,
  favoriteFilter,
  getFilter,
  listFilters,
  runFilter,
  search,
  updateFilter,
  validate,
} = require('../controllers/jqlController');
const { authenticateRequest } = require('../middlewares/authMiddleware');
const { requirePermission } = require('../middlewares/permissionMiddleware');

const router = express.Router();

router.use(authenticateRequest);

router.get('/search', requirePermission('jql', 'read'), search);
router.post('/search', requirePermission('jql', 'read'), search);
router.post('/validate', requirePermission('jql', 'read'), validate);

router.get('/filters', requirePermission('saved_filter', 'read'), listFilters);
router.post('/filters', requirePermission('saved_filter', 'create'), createFilter);
router.get('/filters/:id', requirePermission('saved_filter', 'read'), getFilter);
router.post('/filters/:id/run', requirePermission('jql', 'read'), runFilter);
router.put('/filters/:id', requirePermission('saved_filter', 'update'), updateFilter);
router.patch('/filters/:id/favorite', requirePermission('saved_filter', 'update'), favoriteFilter);
router.delete('/filters/:id', requirePermission('saved_filter', 'delete'), deleteFilter);

module.exports = router;
