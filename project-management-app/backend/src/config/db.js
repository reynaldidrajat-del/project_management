const { Pool } = require('pg');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const requiredEnv = (name) => {
  const value = process.env[name];

  if (!value || !String(value).trim()) {
    throw new Error(`Environment variable ${name} wajib diisi.`);
  }

  return String(value).trim();
};

const parsePort = (value) => {
  const port = Number(value);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error('DB_PORT harus berupa angka port yang valid.');
  }

  return port;
};

const dbConfig = {
  host: requiredEnv('DB_HOST'),
  port: parsePort(requiredEnv('DB_PORT')),
  user: requiredEnv('DB_USER'),
  password: requiredEnv('DB_PASSWORD'),
  database: requiredEnv('DB_NAME'),
};

// Membuat koneksi bersama ke PostgreSQL berdasarkan nilai di file .env.
const pool = new Pool({
  ...dbConfig,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  max: Number(process.env.DB_POOL_MAX || 10),
});

// Fungsi kecil agar semua file lain cukup memanggil query SQL tanpa membuat koneksi baru.
const query = (text, params) => pool.query(text, params);

// Memastikan backend benar-benar terkoneksi ke database aplikasi yang diminta.
const verifyDatabaseConnection = async () => {
  const result = await query(
    `
      SELECT
        current_database() AS database,
        current_schema() AS schema,
        current_user AS user_name,
        inet_server_addr() AS server_addr,
        inet_server_port() AS server_port
    `,
  );
  const connection = result.rows[0];

  if (connection.database !== dbConfig.database) {
    throw new Error(`Database aktif ${connection.database}, tetapi konfigurasi meminta ${dbConfig.database}.`);
  }

  return connection;
};

// Memastikan tabel inti dan akun super admin tersedia sebelum aplikasi menerima request.
const verifyApplicationSchema = async () => {
  const requiredTables = [
    'activity_logs',
    'buckets',
    'calendar_exceptions',
    'departments',
    'locations',
    'project_members',
    'projects',
    'task_assignees',
    'tasks',
    'users',
  ];

  const tableResult = await query(
    `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name = ANY($1)
    `,
    [requiredTables],
  );
  const existingTables = new Set(tableResult.rows.map((row) => row.table_name));
  const missingTables = requiredTables.filter((tableName) => !existingTables.has(tableName));

  if (missingTables.length) {
    throw new Error(`Tabel aplikasi belum lengkap: ${missingTables.join(', ')}.`);
  }

  const passwordColumnResult = await query(
    `
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'users'
        AND column_name = 'password_hash'
      LIMIT 1
    `,
  );

  if (!passwordColumnResult.rowCount) {
    throw new Error('Kolom users.password_hash belum tersedia. Jalankan migration login terlebih dahulu.');
  }

  const superAdminResult = await query(
    `
      SELECT 1
      FROM users
      WHERE role = 'super_admin'
        AND lower(email) = 'superadmin@project-management.local'
      LIMIT 1
    `,
  );

  if (!superAdminResult.rowCount) {
    throw new Error('Akun Super Admin belum tersedia di tabel users.');
  }
};

module.exports = {
  dbConfig,
  pool,
  query,
  verifyApplicationSchema,
  verifyDatabaseConnection,
};
