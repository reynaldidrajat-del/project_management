const express = require('express');
const locationController = require('../controllers/locationController');

const router = express.Router();

// Route untuk membaca semua lokasi/bisnis unit.
router.get('/', locationController.listLocations);
// Route untuk membaca detail satu lokasi.
router.get('/:id', locationController.getLocation);
// Route untuk membuat lokasi baru.
router.post('/', locationController.createLocation);
// Route untuk mengubah lokasi.
router.put('/:id', locationController.updateLocation);
// Route untuk menghapus lokasi.
router.delete('/:id', locationController.deleteLocation);

module.exports = router;
