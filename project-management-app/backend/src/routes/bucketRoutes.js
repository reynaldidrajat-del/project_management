const express = require('express');
const bucketController = require('../controllers/bucketController');
const { requirePermission } = require('../middlewares/permissionMiddleware');

const router = express.Router();

// Route untuk membuat bucket baru di dalam project.
router.post('/', requirePermission('bucket', 'create'), bucketController.createBucket);
// Route untuk mengubah nama atau urutan bucket.
router.put('/:id', requirePermission('bucket', 'update'), bucketController.updateBucket);
// Route untuk menghapus bucket.
router.delete('/:id', requirePermission('bucket', 'delete'), bucketController.deleteBucket);

module.exports = router;
