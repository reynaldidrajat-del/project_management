const { query } = require('../config/db');
const { logActivity } = require('../services/activityService');
const { asyncHandler, sendError, sendSuccess } = require('../utils/responseUtils');

const getRequestActivityContext = (req) => ({
  actor_user_id: req.user?.id || null,
  ip_address: req.ip,
  user_agent: req.headers['user-agent'],
});

// Query dasar untuk mengambil user sekaligus nama department-nya.
const USER_SELECT = `
  SELECT
    u.id,
    u.name,
    u.email,
    u.role,
    u.department_id,
    d.name AS department_name,
    u.location_id,
    l.name AS location_name,
    u.created_at,
    u.updated_at
  FROM users u
  LEFT JOIN departments d ON d.id = u.department_id
  LEFT JOIN locations l ON l.id = u.location_id
`;

// Mengambil semua user/PIC untuk pilihan form dan halaman team.
const listUsers = asyncHandler(async (_req, res) => {
  const result = await query(`${USER_SELECT} ORDER BY u.name ASC`);
  sendSuccess(res, result.rows);
});

// Mengambil detail satu user berdasarkan id.
const getUser = asyncHandler(async (req, res) => {
  const result = await query(`${USER_SELECT} WHERE u.id = $1`, [req.params.id]);

  if (!result.rows[0]) {
    return sendError(res, 'User tidak ditemukan.', 'User tidak ditemukan.', 404);
  }

  return sendSuccess(res, result.rows[0]);
});

// Membuat user baru setelah nama user divalidasi.
const createUser = asyncHandler(async (req, res) => {
  if (!req.body.name) {
    return sendError(res, 'Nama user wajib diisi.', 'Validasi gagal.', 400);
  }

  const result = await query(
    `
      INSERT INTO users (name, email, role, department_id, location_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `,
    [
      req.body.name,
      req.body.email || null,
      req.body.role || 'admin',
      req.body.department_id || null,
      req.body.location_id || null,
    ],
  );

  const user = await query(`${USER_SELECT} WHERE u.id = $1`, [result.rows[0].id]);
  await logActivity({
    ...getRequestActivityContext(req),
    action: 'user.create',
    object_type: 'user',
    object_id: user.rows[0].id,
    description: `User "${user.rows[0].name}" dibuat.`,
    metadata: { role: user.rows[0].role, department_id: user.rows[0].department_id, location_id: user.rows[0].location_id },
  });
  return sendSuccess(res, user.rows[0], 'User berhasil dibuat.', 201);
});

// Mengubah data user seperti nama, email, role, department, dan lokasi bisnis unit.
const updateUser = asyncHandler(async (req, res) => {
  if (!req.body.name) {
    return sendError(res, 'Nama user wajib diisi.', 'Validasi gagal.', 400);
  }

  const result = await query(
    `
      UPDATE users
      SET name = $1, email = $2, role = $3, department_id = $4, location_id = $5
      WHERE id = $6
      RETURNING id
    `,
    [
      req.body.name,
      req.body.email || null,
      req.body.role || 'admin',
      req.body.department_id || null,
      req.body.location_id || null,
      req.params.id,
    ],
  );

  if (!result.rows[0]) {
    return sendError(res, 'User tidak ditemukan.', 'User tidak ditemukan.', 404);
  }

  const user = await query(`${USER_SELECT} WHERE u.id = $1`, [req.params.id]);
  await logActivity({
    ...getRequestActivityContext(req),
    action: 'user.update',
    object_type: 'user',
    object_id: user.rows[0].id,
    description: `User "${user.rows[0].name}" diperbarui.`,
    metadata: { role: user.rows[0].role, department_id: user.rows[0].department_id, location_id: user.rows[0].location_id },
  });
  return sendSuccess(res, user.rows[0], 'User berhasil diperbarui.');
});

// Menghapus user berdasarkan id.
const deleteUser = asyncHandler(async (req, res) => {
  const existingUser = await query(`${USER_SELECT} WHERE u.id = $1`, [req.params.id]);

  if (!existingUser.rows[0]) {
    return sendError(res, 'User tidak ditemukan.', 'User tidak ditemukan.', 404);
  }

  await logActivity({
    ...getRequestActivityContext(req),
    action: 'user.delete',
    object_type: 'user',
    object_id: existingUser.rows[0].id,
    description: `User "${existingUser.rows[0].name}" dihapus.`,
  });

  const result = await query('DELETE FROM users WHERE id = $1 RETURNING id', [req.params.id]);

  if (!result.rows[0]) {
    return sendError(res, 'User tidak ditemukan.', 'User tidak ditemukan.', 404);
  }

  return sendSuccess(res, result.rows[0], 'User berhasil dihapus.');
});

module.exports = {
  createUser,
  deleteUser,
  getUser,
  listUsers,
  updateUser,
};
