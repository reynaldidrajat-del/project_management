const express = require('express');
const authController = require('../controllers/authController');
const { authenticateRequest } = require('../middlewares/authMiddleware');

const router = express.Router();

// Route login aplikasi Project Management.
router.post('/login', authController.login);
// Route untuk membaca user dari session aktif.
router.get('/me', authenticateRequest, authController.getMe);
// Route untuk mencabut session login aktif.
router.post('/logout', authenticateRequest, authController.logout);

module.exports = router;
