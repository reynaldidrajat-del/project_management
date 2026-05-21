const express = require('express');
const dashboardController = require('../controllers/dashboardController');

const router = express.Router();

// Route untuk mengambil ringkasan angka dashboard seperti project, task, dan overdue.
router.get('/summary', dashboardController.getSummary);

module.exports = router;
