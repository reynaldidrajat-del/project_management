const express = require('express');
const calendarController = require('../controllers/calendarController');
const { requirePermission } = require('../middlewares/permissionMiddleware');

const router = express.Router();

// Route untuk membaca daftar tanggal libur atau hari kerja khusus.
router.get('/exceptions', calendarController.listCalendarExceptions);
// Route untuk memasukkan daftar hari libur nasional Indonesia tahun 2026.
router.post('/indonesia-holidays/2026', requirePermission('calendar', 'create'), calendarController.importIndonesiaHolidays);
// Route untuk membuat tanggal pengecualian kalender baru.
router.post('/exceptions', requirePermission('calendar', 'create'), calendarController.createException);
// Route untuk mengubah tanggal pengecualian kalender.
router.put('/exceptions/:id', requirePermission('calendar', 'update'), calendarController.updateException);
// Route untuk menghapus tanggal pengecualian kalender.
router.delete('/exceptions/:id', requirePermission('calendar', 'delete'), calendarController.deleteException);

module.exports = router;
