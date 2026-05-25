const { query } = require('../config/db');

const ROLE_PERMISSION_FALLBACKS = {
  super_admin: [{ resource: '*', action: '*' }],
  admin: [
    { resource: '*', action: 'read' },
    { resource: 'activity', action: 'read' },
    { resource: 'bucket', action: '*' },
    { resource: 'calendar', action: '*' },
    { resource: 'chat', action: '*' },
    { resource: 'department', action: '*' },
    { resource: 'location', action: '*' },
    { resource: 'notification', action: '*' },
    { resource: 'project', action: '*' },
    { resource: 'task', action: '*' },
    { resource: 'task_checklist', action: '*' },
    { resource: 'task_comment', action: '*' },
    { resource: 'task_label', action: '*' },
    { resource: 'user', action: '*' },
  ],
  manager: [
    { resource: '*', action: 'read' },
    { resource: 'activity', action: 'read' },
    { resource: 'bucket', action: '*' },
    { resource: 'calendar', action: '*' },
    { resource: 'chat', action: '*' },
    { resource: 'notification', action: '*' },
    { resource: 'project', action: '*' },
    { resource: 'task', action: '*' },
    { resource: 'task_checklist', action: '*' },
    { resource: 'task_comment', action: '*' },
    { resource: 'task_label', action: '*' },
  ],
  contributor: [
    { resource: '*', action: 'read' },
    { resource: 'activity', action: 'read' },
    { resource: 'task', action: 'create' },
    { resource: 'task', action: 'move' },
    { resource: 'task', action: 'progress' },
    { resource: 'task', action: 'realization' },
    { resource: 'task', action: 'approve' },
    { resource: 'task', action: 'update' },
    { resource: 'task_checklist', action: 'create' },
    { resource: 'task_checklist', action: 'delete' },
    { resource: 'task_checklist', action: 'update' },
    { resource: 'task_comment', action: 'create' },
    { resource: 'task_comment', action: 'delete' },
    { resource: 'task_comment', action: 'update' },
    { resource: 'chat', action: 'create' },
    { resource: 'chat', action: 'delete' },
    { resource: 'chat', action: 'read' },
    { resource: 'chat', action: 'update' },
    { resource: 'notification', action: 'read' },
    { resource: 'notification', action: 'update' },
  ],
  member: [
    { resource: '*', action: 'read' },
    { resource: 'activity', action: 'read' },
    { resource: 'task', action: 'create' },
    { resource: 'task', action: 'move' },
    { resource: 'task', action: 'progress' },
    { resource: 'task', action: 'realization' },
    { resource: 'task', action: 'approve' },
    { resource: 'task', action: 'update' },
    { resource: 'task_checklist', action: 'create' },
    { resource: 'task_checklist', action: 'delete' },
    { resource: 'task_checklist', action: 'update' },
    { resource: 'task_comment', action: 'create' },
    { resource: 'task_comment', action: 'delete' },
    { resource: 'task_comment', action: 'update' },
    { resource: 'chat', action: 'create' },
    { resource: 'chat', action: 'delete' },
    { resource: 'chat', action: 'read' },
    { resource: 'chat', action: 'update' },
    { resource: 'notification', action: 'read' },
    { resource: 'notification', action: 'update' },
  ],
  viewer: [
    { resource: '*', action: 'read' },
    { resource: 'activity', action: 'read' },
    { resource: 'chat', action: 'read' },
    { resource: 'notification', action: 'read' },
    { resource: 'notification', action: 'update' },
  ],
};

const normalizeRole = (role) => String(role || 'viewer').trim();

const ruleMatches = (rule, resource, action) => {
  const resourceMatches = rule.resource === '*' || rule.resource === resource;
  const actionMatches = rule.action === '*' || rule.action === action;

  return resourceMatches && actionMatches;
};

const getFallbackPermission = (role, resource, action) => {
  const rules = ROLE_PERMISSION_FALLBACKS[normalizeRole(role)] || ROLE_PERMISSION_FALLBACKS.viewer;
  return rules.some((rule) => ruleMatches(rule, resource, action));
};

// Mengecek permission dari tabel role_permissions dengan fallback agar aplikasi tetap jalan saat migration belum lengkap.
const hasPermission = async (user, resource, action) => {
  if (!user) {
    return false;
  }

  const role = normalizeRole(user.role);

  if (role === 'super_admin') {
    return true;
  }

  try {
    const result = await query(
      `
        SELECT allowed
        FROM role_permissions
        WHERE role = $1
          AND resource IN ($2, '*')
          AND action IN ($3, '*')
        ORDER BY
          CASE WHEN resource = $2 THEN 0 ELSE 1 END,
          CASE WHEN action = $3 THEN 0 ELSE 1 END
        LIMIT 1
      `,
      [role, resource, action],
    );

    if (result.rows[0]) {
      return Boolean(result.rows[0].allowed);
    }
  } catch (error) {
    if (error.code !== '42P01') {
      throw error;
    }
  }

  return getFallbackPermission(role, resource, action);
};

const ensurePermission = async (user, resource, action) => {
  const allowed = await hasPermission(user, resource, action);

  if (!allowed) {
    throw new Error('User tidak memiliki izin untuk menjalankan aksi ini.');
  }
};

module.exports = {
  ensurePermission,
  hasPermission,
};
