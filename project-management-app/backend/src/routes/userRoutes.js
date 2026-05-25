const express = require('express');
const userController = require('../controllers/userController');
const { requirePermission } = require('../middlewares/permissionMiddleware');

const router = express.Router();

// Route untuk membaca semua user/PIC.
router.get('/', userController.listUsers);
// Route untuk membaca detail satu user.
router.get('/:id', userController.getUser);
// Route untuk membuat user baru.
router.post('/', requirePermission('user', 'create'), userController.createUser);
// Route untuk mengubah user.
router.put('/:id', requirePermission('user', 'update'), userController.updateUser);
// Route untuk menghapus user.
router.delete('/:id', requirePermission('user', 'delete'), userController.deleteUser);

module.exports = router;
