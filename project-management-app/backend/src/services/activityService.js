const { query } = require('../config/db');

const DEFAULT_ACTIVITY_LIMIT = 50;
const MAX_ACTIVITY_LIMIT = 100;

const normalizeActivityLimit = (limit) => {
  const numericLimit = Number(limit || DEFAULT_ACTIVITY_LIMIT);

  if (!Number.isInteger(numericLimit) || numericLimit <= 0) {
    return DEFAULT_ACTIVITY_LIMIT;
  }

  return Math.min(numericLimit, MAX_ACTIVITY_LIMIT);
};

const normalizeActivityOffset = (offset) => {
  const numericOffset = Number(offset || 0);

  if (!Number.isInteger(numericOffset) || numericOffset < 0) {
    return 0;
  }

  return numericOffset;
};

// Menyimpan audit trail untuk perubahan penting agar aktivitas bisa ditelusuri.
const logActivity = async ({
  actor_user_id,
  user_id,
  task_id,
  project_id,
  action,
  object_type,
  object_id,
  description,
  metadata = {},
  ip_address,
  user_agent,
} = {}) => {
  if (!action) {
    return null;
  }

  const actorUserId = actor_user_id || user_id || null;

  const result = await query(
    `
      INSERT INTO activity_logs (
        user_id,
        actor_user_id,
        task_id,
        project_id,
        action,
        object_type,
        object_id,
        description,
        metadata,
        ip_address,
        user_agent
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::JSONB, $10, $11)
      RETURNING *
    `,
    [
      actorUserId,
      actorUserId,
      task_id || null,
      project_id || null,
      action,
      object_type || null,
      object_id || null,
      description || null,
      JSON.stringify(metadata || {}),
      ip_address || null,
      user_agent || null,
    ],
  );

  return result.rows[0] || null;
};

// Membaca activity feed dengan filter ringan untuk halaman Activity project/global.
const listActivities = async (filters = {}) => {
  const conditions = [];
  const values = [];

  if (filters.project_id) {
    values.push(filters.project_id);
    conditions.push(`al.project_id = $${values.length}`);
  }

  if (filters.task_id) {
    values.push(filters.task_id);
    conditions.push(`al.task_id = $${values.length}`);
  }

  if (filters.actor_user_id) {
    values.push(filters.actor_user_id);
    conditions.push(`al.actor_user_id = $${values.length}`);
  }

  if (filters.action) {
    values.push(filters.action);
    conditions.push(`al.action = $${values.length}`);
  }

  if (filters.object_type) {
    values.push(filters.object_type);
    conditions.push(`al.object_type = $${values.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = normalizeActivityLimit(filters.limit);
  const offset = normalizeActivityOffset(filters.offset);

  values.push(limit);
  const limitParam = `$${values.length}`;
  values.push(offset);
  const offsetParam = `$${values.length}`;

  const result = await query(
    `
      SELECT
        al.id,
        al.user_id,
        al.actor_user_id,
        actor.name AS actor_name,
        actor.email AS actor_email,
        al.task_id,
        t.title AS task_title,
        al.project_id,
        p.name AS project_name,
        al.action,
        al.object_type,
        al.object_id,
        al.description,
        COALESCE(al.metadata, '{}'::JSONB) AS metadata,
        al.ip_address,
        al.user_agent,
        al.created_at
      FROM activity_logs al
      LEFT JOIN users actor ON actor.id = al.actor_user_id
      LEFT JOIN tasks t ON t.id = al.task_id
      LEFT JOIN projects p ON p.id = al.project_id
      ${whereClause}
      ORDER BY al.created_at DESC, al.id DESC
      LIMIT ${limitParam}
      OFFSET ${offsetParam}
    `,
    values,
  );

  return result.rows;
};

module.exports = {
  listActivities,
  logActivity,
};
