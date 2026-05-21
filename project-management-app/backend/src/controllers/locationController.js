const { query } = require('../config/db');
const { asyncHandler, sendError, sendSuccess } = require('../utils/responseUtils');

// Mengambil semua lokasi/bisnis unit untuk master data dan filter.
const listLocations = asyncHandler(async (_req, res) => {
  const result = await query('SELECT * FROM locations ORDER BY name ASC');
  sendSuccess(res, result.rows);
});

// Mengambil detail satu lokasi berdasarkan id.
const getLocation = asyncHandler(async (req, res) => {
  const result = await query('SELECT * FROM locations WHERE id = $1', [req.params.id]);

  if (!result.rows[0]) {
    return sendError(res, 'Lokasi tidak ditemukan.', 'Lokasi tidak ditemukan.', 404);
  }

  return sendSuccess(res, result.rows[0]);
});

// Membuat lokasi baru setelah nama lokasi divalidasi.
const createLocation = asyncHandler(async (req, res) => {
  if (!req.body.name) {
    return sendError(res, 'Nama lokasi wajib diisi.', 'Validasi gagal.', 400);
  }

  const result = await query('INSERT INTO locations (name) VALUES ($1) RETURNING *', [req.body.name]);
  return sendSuccess(res, result.rows[0], 'Lokasi berhasil dibuat.', 201);
});

// Mengubah nama lokasi yang sudah ada.
const updateLocation = asyncHandler(async (req, res) => {
  if (!req.body.name) {
    return sendError(res, 'Nama lokasi wajib diisi.', 'Validasi gagal.', 400);
  }

  const result = await query('UPDATE locations SET name = $1 WHERE id = $2 RETURNING *', [
    req.body.name,
    req.params.id,
  ]);

  if (!result.rows[0]) {
    return sendError(res, 'Lokasi tidak ditemukan.', 'Lokasi tidak ditemukan.', 404);
  }

  return sendSuccess(res, result.rows[0], 'Lokasi berhasil diperbarui.');
});

// Menghapus lokasi berdasarkan id. User terkait akan otomatis menjadi tanpa lokasi.
const deleteLocation = asyncHandler(async (req, res) => {
  const result = await query('DELETE FROM locations WHERE id = $1 RETURNING id', [req.params.id]);

  if (!result.rows[0]) {
    return sendError(res, 'Lokasi tidak ditemukan.', 'Lokasi tidak ditemukan.', 404);
  }

  return sendSuccess(res, result.rows[0], 'Lokasi berhasil dihapus.');
});

module.exports = {
  createLocation,
  deleteLocation,
  getLocation,
  listLocations,
  updateLocation,
};
