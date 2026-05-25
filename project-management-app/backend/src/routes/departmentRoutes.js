const express = require('express');
const departmentController = require('../controllers/departmentController');
const { requirePermission } = require('../middlewares/permissionMiddleware');

const router = express.Router();

// Route untuk membaca semua department.
router.get('/', departmentController.listDepartments);
// Route untuk membaca detail satu department.
router.get('/:id', departmentController.getDepartment);
// Route untuk membuat department baru.
router.post('/', requirePermission('department', 'create'), departmentController.createDepartment);
// Route untuk mengubah nama department.
router.put('/:id', requirePermission('department', 'update'), departmentController.updateDepartment);
// Route untuk menghapus department.
router.delete('/:id', requirePermission('department', 'delete'), departmentController.deleteDepartment);

module.exports = router;
