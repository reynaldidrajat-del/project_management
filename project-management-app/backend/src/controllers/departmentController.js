const { query } = require('../config/db');
const { asyncHandler, sendError, sendSuccess } = require('../utils/responseUtils');

// Mengambil semua department yang dipakai untuk filter, user, dan laporan.
const listDepartments = asyncHandler(async (_req, res) => {
  const result = await query('SELECT * FROM departments ORDER BY name ASC');
  sendSuccess(res, result.rows);
});

// Mengambil detail satu department berdasarkan id.
const getDepartment = asyncHandler(async (req, res) => {
  const result = await query('SELECT * FROM departments WHERE id = $1', [req.params.id]);

  if (!result.rows[0]) {
    return sendError(res, 'Department tidak ditemukan.', 'Department tidak ditemukan.', 404);
  }

  return sendSuccess(res, result.rows[0]);
});

// Membuat department baru setelah nama department divalidasi.
const createDepartment = asyncHandler(async (req, res) => {
  if (!req.body.name) {
    return sendError(res, 'Nama department wajib diisi.', 'Validasi gagal.', 400);
  }

  const result = await query('INSERT INTO departments (name) VALUES ($1) RETURNING *', [req.body.name]);
  return sendSuccess(res, result.rows[0], 'Department berhasil dibuat.', 201);
});

// Mengubah nama department yang sudah ada.
const updateDepartment = asyncHandler(async (req, res) => {
  if (!req.body.name) {
    return sendError(res, 'Nama department wajib diisi.', 'Validasi gagal.', 400);
  }

  const result = await query('UPDATE departments SET name = $1 WHERE id = $2 RETURNING *', [
    req.body.name,
    req.params.id,
  ]);

  if (!result.rows[0]) {
    return sendError(res, 'Department tidak ditemukan.', 'Department tidak ditemukan.', 404);
  }

  return sendSuccess(res, result.rows[0], 'Department berhasil diperbarui.');
});

// Menghapus department berdasarkan id.
const deleteDepartment = asyncHandler(async (req, res) => {
  const result = await query('DELETE FROM departments WHERE id = $1 RETURNING id', [req.params.id]);

  if (!result.rows[0]) {
    return sendError(res, 'Department tidak ditemukan.', 'Department tidak ditemukan.', 404);
  }

  return sendSuccess(res, result.rows[0], 'Department berhasil dihapus.');
});

module.exports = {
  createDepartment,
  deleteDepartment,
  getDepartment,
  listDepartments,
  updateDepartment,
};
