const express = require('express');
const bucketController = require('../controllers/bucketController');

const router = express.Router();

// Route untuk membuat bucket baru di dalam project.
router.post('/', bucketController.createBucket);
// Route untuk mengubah nama atau urutan bucket.
router.put('/:id', bucketController.updateBucket);
// Route untuk menghapus bucket.
router.delete('/:id', bucketController.deleteBucket);

module.exports = router;
