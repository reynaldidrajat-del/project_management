const express = require('express');
const userController = require('../controllers/userController');

const router = express.Router();

// Route untuk membaca semua user/PIC.
router.get('/', userController.listUsers);
// Route untuk membaca detail satu user.
router.get('/:id', userController.getUser);
// Route untuk membuat user baru.
router.post('/', userController.createUser);
// Route untuk mengubah user.
router.put('/:id', userController.updateUser);
// Route untuk menghapus user.
router.delete('/:id', userController.deleteUser);

module.exports = router;
