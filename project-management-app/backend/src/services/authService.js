const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { z } = require('zod');

const { query } = require('../config/db');
const { logActivity } = require('./activityService');

const DEFAULT_PASSWORD = 'modern888';
const LEGACY_PASSWORD_HASH_PREFIX = 'sha256:';
const BCRYPT_PASSWORD_HASH_PREFIX = '$2';
const SESSION_TOKEN_BYTES = 32;
const SESSION_HOURS = Number(process.env.AUTH_SESSION_HOURS || 12);
const BCRYPT_COST = Number(process.env.AUTH_BCRYPT_COST || 10);

const loginSchema = z.object({
  identifier: z.string().trim().min(1, 'Nama atau email wajib diisi.'),
  password: z.string().min(1, 'Password wajib diisi.'),
});

const legacyHashPassword = (password) => {
  return `${LEGACY_PASSWORD_HASH_PREFIX}${crypto.createHash('sha256').update(String(password)).digest('hex')}`;
};

const hashPassword = async (password) => bcrypt.hash(String(password), BCRYPT_COST);

const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

const DEFAULT_PASSWORD_HASH = legacyHashPassword(DEFAULT_PASSWORD);

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
    is_active: user.is_active,
  };
};

const isBcryptHash = (storedHash = '') => String(storedHash).startsWith(BCRYPT_PASSWORD_HASH_PREFIX);

const isLegacyHash = (storedHash = '') => String(storedHash).startsWith(LEGACY_PASSWORD_HASH_PREFIX);

// Membandingkan password input user dengan hash yang tersimpan, termasuk hash lama untuk migrasi bertahap.
const verifyPassword = async (password, storedHash) => {
  const expectedHash = storedHash || DEFAULT_PASSWORD_HASH;

  if (isBcryptHash(expectedHash)) {
    return bcrypt.compare(String(password), expectedHash);
  }

  if (isLegacyHash(expectedHash)) {
    return legacyHashPassword(password) === expectedHash;
  }

  return false;
};

const createSession = async (userId, { userAgent, ipAddress } = {}) => {
  const token = crypto.randomBytes(SESSION_TOKEN_BYTES).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);

  const result = await query(
    `
      INSERT INTO auth_sessions (user_id, token_hash, user_agent, ip_address, expires_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, user_id, expires_at, created_at
    `,
    [userId, tokenHash, userAgent || null, ipAddress || null, expiresAt],
  );

  return {
    session: result.rows[0],
    token,
  };
};

// Login memakai nama atau email dari master Team dan membuat session token.
const loginUser = async (payload = {}, requestContext = {}) => {
  const parsedResult = loginSchema.safeParse(payload);

  if (!parsedResult.success) {
    throw new Error(parsedResult.error.issues[0]?.message || 'Payload login tidak valid.');
  }

  const parsedPayload = parsedResult.data;
  const normalizedIdentifier = parsedPayload.identifier;

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
        l.name AS location_name,
        COALESCE(u.is_active, TRUE) AS is_active
      FROM users u
      LEFT JOIN departments d ON d.id = u.department_id
      LEFT JOIN locations l ON l.id = u.location_id
      WHERE u.deleted_at IS NULL
        AND (
          lower(trim(u.name)) = lower(trim($1))
          OR lower(trim(COALESCE(u.email, ''))) = lower(trim($1))
        )
      ORDER BY
        CASE WHEN lower(trim(COALESCE(u.email, ''))) = lower(trim($1)) THEN 0 ELSE 1 END,
        u.id ASC
      LIMIT 1
    `,
    [normalizedIdentifier],
  );

  const user = result.rows[0];

  if (!user || !(await verifyPassword(parsedPayload.password, user.password_hash))) {
    throw new Error('Nama/email atau password tidak valid.');
  }

  if (!user.is_active) {
    throw new Error('User tidak aktif.');
  }

  if (isLegacyHash(user.password_hash)) {
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [await hashPassword(parsedPayload.password), user.id]);
  }

  await query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

  const { session, token } = await createSession(user.id, requestContext);

  await logActivity({
    actor_user_id: user.id,
    action: 'auth.login',
    object_type: 'user',
    object_id: user.id,
    description: `User "${user.name}" login ke aplikasi.`,
    ip_address: requestContext.ipAddress,
    user_agent: requestContext.userAgent,
  });

  return {
    user: sanitizeAuthUser(user),
    token,
    expires_at: session.expires_at,
  };
};

const getAuthenticatedSession = async (token) => {
  if (!token) {
    return null;
  }

  const result = await query(
    `
      SELECT
        s.id AS session_id,
        s.user_id AS session_user_id,
        s.expires_at,
        s.created_at AS session_created_at,
        u.id,
        u.name,
        u.email,
        u.role,
        u.department_id,
        d.name AS department_name,
        u.location_id,
        l.name AS location_name,
        COALESCE(u.is_active, TRUE) AS is_active
      FROM auth_sessions s
      INNER JOIN users u ON u.id = s.user_id
      LEFT JOIN departments d ON d.id = u.department_id
      LEFT JOIN locations l ON l.id = u.location_id
      WHERE s.token_hash = $1
        AND s.revoked_at IS NULL
        AND s.expires_at > CURRENT_TIMESTAMP
        AND u.deleted_at IS NULL
      LIMIT 1
    `,
    [hashToken(token)],
  );

  const row = result.rows[0];

  if (!row || !row.is_active) {
    return null;
  }

  return {
    session: {
      id: row.session_id,
      user_id: row.session_user_id,
      expires_at: row.expires_at,
      created_at: row.session_created_at,
    },
    user: sanitizeAuthUser(row),
  };
};

const logoutUser = async (token, requestContext = {}) => {
  if (!token) {
    return { revoked: false };
  }

  const session = await getAuthenticatedSession(token);

  await query(
    `
      UPDATE auth_sessions
      SET revoked_at = CURRENT_TIMESTAMP
      WHERE token_hash = $1
        AND revoked_at IS NULL
    `,
    [hashToken(token)],
  );

  if (session?.user) {
    await logActivity({
      actor_user_id: session.user.id,
      action: 'auth.logout',
      object_type: 'user',
      object_id: session.user.id,
      description: `User "${session.user.name}" logout dari aplikasi.`,
      ip_address: requestContext.ipAddress,
      user_agent: requestContext.userAgent,
    });
  }

  return { revoked: true };
};

module.exports = {
  DEFAULT_PASSWORD_HASH,
  getAuthenticatedSession,
  hashPassword,
  loginUser,
  logoutUser,
  sanitizeAuthUser,
};
