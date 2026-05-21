const express = require('express');
const departmentController = require('../controllers/departmentController');

const router = express.Router();

// Route untuk membaca semua department.
router.get('/', departmentController.listDepartments);
// Route untuk membaca detail satu department.
router.get('/:id', departmentController.getDepartment);
// Route untuk membuat department baru.
router.post('/', departmentController.createDepartment);
// Route untuk mengubah nama department.
router.put('/:id', departmentController.updateDepartment);
// Route untuk menghapus department.
router.delete('/:id', departmentController.deleteDepartment);

module.exports = router;
