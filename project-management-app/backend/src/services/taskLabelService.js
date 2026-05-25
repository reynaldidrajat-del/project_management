const { query } = require('../config/db');
const { logActivity } = require('./activityService');

const VALID_LABEL_COLORS = ['slate', 'blue', 'green', 'amber', 'red', 'purple', 'pink', 'cyan'];

const normalizeLabelColor = (color) => {
  return VALID_LABEL_COLORS.includes(color) ? color : 'slate';
};

const normalizeLabelName = (name) => String(name || '').trim().replace(/\s+/g, ' ');

const getTaskLabels = async (filters = {}) => {
  const conditions = [];
  const values = [];

  if (filters.project_id) {
    values.push(filters.project_id);
    conditions.push(`tl.project_id = $${values.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await query(
    `
      SELECT
        tl.id,
        tl.project_id,
        p.name AS project_name,
        tl.name,
        tl.color,
        COUNT(tla.task_id)::INTEGER AS task_count,
        tl.created_at,
        tl.updated_at
      FROM task_labels tl
      LEFT JOIN projects p ON p.id = tl.project_id
      LEFT JOIN task_label_assignments tla ON tla.label_id = tl.id
      ${whereClause}
      GROUP BY tl.id, p.name
      ORDER BY p.name NULLS LAST, tl.name
    `,
    values,
  );

  return result.rows;
};

const createTaskLabel = async (payload = {}, context = {}) => {
  const name = normalizeLabelName(payload.name);

  if (!payload.project_id) {
    throw new Error('Project label wajib diisi.');
  }

  if (!name) {
    throw new Error('Nama label wajib diisi.');
  }

  const result = await query(
    `
      INSERT INTO task_labels (project_id, name, color)
      VALUES ($1, $2, $3)
      RETURNING *
    `,
    [payload.project_id, name, normalizeLabelColor(payload.color)],
  );

  const label = result.rows[0];

  await logActivity({
    actor_user_id: context.actor_user_id,
    project_id: label.project_id,
    action: 'task_label.create',
    object_type: 'task_label',
    object_id: label.id,
    description: `Label task "${label.name}" dibuat.`,
    metadata: { color: label.color },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  return label;
};

const updateTaskLabel = async (id, payload = {}, context = {}) => {
  const name = normalizeLabelName(payload.name);

  if (!name) {
    throw new Error('Nama label wajib diisi.');
  }

  const result = await query(
    `
      UPDATE task_labels
      SET name = $1, color = $2
      WHERE id = $3
      RETURNING *
    `,
    [name, normalizeLabelColor(payload.color), id],
  );

  if (!result.rows[0]) {
    throw new Error('Label task tidak ditemukan.');
  }

  const label = result.rows[0];

  await logActivity({
    actor_user_id: context.actor_user_id,
    project_id: label.project_id,
    action: 'task_label.update',
    object_type: 'task_label',
    object_id: label.id,
    description: `Label task "${label.name}" diperbarui.`,
    metadata: { color: label.color },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  return label;
};

const deleteTaskLabel = async (id, context = {}) => {
  const labelResult = await query('SELECT * FROM task_labels WHERE id = $1', [id]);
  const label = labelResult.rows[0];

  if (!label) {
    throw new Error('Label task tidak ditemukan.');
  }

  await logActivity({
    actor_user_id: context.actor_user_id,
    project_id: label.project_id,
    action: 'task_label.delete',
    object_type: 'task_label',
    object_id: label.id,
    description: `Label task "${label.name}" dihapus.`,
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  await query('DELETE FROM task_labels WHERE id = $1', [id]);

  return { id: Number(id) };
};

module.exports = {
  createTaskLabel,
  deleteTaskLabel,
  getTaskLabels,
  updateTaskLabel,
};
