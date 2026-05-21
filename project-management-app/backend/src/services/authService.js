const crypto = require('crypto');

const { query } = require('../config/db');

const DEFAULT_PASSWORD = 'modern888';
const PASSWORD_HASH_PREFIX = 'sha256:';

// Membuat hash sederhana untuk password login lokal tanpa menyimpan password polos.
const hashPassword = (password) => {
  return `${PASSWORD_HASH_PREFIX}${crypto.createHash('sha256').update(String(password)).digest('hex')}`;
};

const DEFAULT_PASSWORD_HASH = hashPassword(DEFAULT_PASSWORD);

// Menghapus field sensitif sebelum data user dikirim ke frontend.
const sanitizeAuthUser = (user) => {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    department_id: user.department_id,
    department_name: user.department_name,
    location_id: user.location_id,
    location_name: user.location_name,
  };
};

// Membandingkan password input user dengan hash yang tersimpan di database.
const verifyPassword = (password, storedHash) => {
  const expectedHash = storedHash || DEFAULT_PASSWORD_HASH;
  return hashPassword(password) === expectedHash;
};

// Login memakai nama atau email dari master Team.
const loginUser = async ({ identifier, password } = {}) => {
  const normalizedIdentifier = String(identifier || '').trim();

  if (!normalizedIdentifier) {
    throw new Error('Nama atau email wajib diisi.');
  }

  if (!password) {
    throw new Error('Password wajib diisi.');
  }

  const result = await query(
    `
      SELECT
        u.id,
        u.name,
        u.email,
        u.role,
        u.password_hash,
        u.department_id,
        d.name AS department_name,
        u.location_id,
        l.name AS location_name
      FROM users u
      LEFT JOIN departments d ON d.id = u.department_id
      LEFT JOIN locations l ON l.id = u.location_id
      WHERE lower(trim(u.name)) = lower(trim($1))
        OR lower(trim(COALESCE(u.email, ''))) = lower(trim($1))
      ORDER BY
        CASE WHEN lower(trim(COALESCE(u.email, ''))) = lower(trim($1)) THEN 0 ELSE 1 END,
        u.id ASC
      LIMIT 1
    `,
    [normalizedIdentifier],
  );

  const user = result.rows[0];

  if (!user || !verifyPassword(password, user.password_hash)) {
    throw new Error('Nama/email atau password tidak valid.');
  }

  return sanitizeAuthUser(user);
};

module.exports = {
  DEFAULT_PASSWORD_HASH,
  hashPassword,
  loginUser,
  sanitizeAuthUser,
};
