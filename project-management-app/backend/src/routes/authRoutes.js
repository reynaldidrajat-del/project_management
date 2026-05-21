const express = require('express');
const authController = require('../controllers/authController');

const router = express.Router();

// Route login aplikasi Project Management.
router.post('/login', authController.login);

module.exports = router;
