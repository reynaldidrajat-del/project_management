const { query } = require('../config/db');
const { asyncHandler, sendError, sendSuccess } = require('../utils/responseUtils');

// Mengambil semua bucket milik satu project untuk pilihan board dan form task.
const getBucketsByProject = asyncHandler(async (req, res) => {
  const result = await query('SELECT * FROM buckets WHERE project_id = $1 ORDER BY sort_order, id', [
    req.params.projectId,
  ]);

  sendSuccess(res, result.rows);
});

// Membuat bucket baru setelah memastikan project dan nama bucket sudah diisi.
const createBucket = asyncHandler(async (req, res) => {
  if (!req.body.project_id || !req.body.name) {
    return sendError(res, 'Project dan nama bucket wajib diisi.', 'Validasi gagal.', 400);
  }

  const result = await query(
    `
      INSERT INTO buckets (project_id, name, sort_order)
      VALUES ($1, $2, $3)
      RETURNING *
    `,
    [req.body.project_id, req.body.name, req.body.sort_order || 0],
  );

  return sendSuccess(res, result.rows[0], 'Bucket berhasil dibuat.', 201);
});

// Mengubah data bucket yang sudah ada, lalu memberi error jika bucket tidak ditemukan.
const updateBucket = asyncHandler(async (req, res) => {
  if (!req.body.name) {
    return sendError(res, 'Nama bucket wajib diisi.', 'Validasi gagal.', 400);
  }

  const result = await query(
    `
      UPDATE buckets
      SET name = $1, sort_order = $2
      WHERE id = $3
      RETURNING *
    `,
    [req.body.name, req.body.sort_order || 0, req.params.id],
  );

  if (!result.rows[0]) {
    return sendError(res, 'Bucket tidak ditemukan.', 'Bucket tidak ditemukan.', 404);
  }

  return sendSuccess(res, result.rows[0], 'Bucket berhasil diperbarui.');
});

// Menghapus bucket berdasarkan id.
const deleteBucket = asyncHandler(async (req, res) => {
  const result = await query('DELETE FROM buckets WHERE id = $1 RETURNING id', [req.params.id]);

  if (!result.rows[0]) {
    return sendError(res, 'Bucket tidak ditemukan.', 'Bucket tidak ditemukan.', 404);
  }

  return sendSuccess(res, result.rows[0], 'Bucket berhasil dihapus.');
});

module.exports = {
  createBucket,
  deleteBucket,
  getBucketsByProject,
  updateBucket,
};
