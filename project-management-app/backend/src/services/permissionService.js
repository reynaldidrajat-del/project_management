const { query } = require('../config/db');

const ROLE_PERMISSION_FALLBACKS = {
  super_admin: [{ resource: '*', action: '*' }],
  admin: [
    { resource: '*', action: 'read' },
    { resource: 'activity', action: 'read' },
    { resource: 'automation', action: '*' },
    { resource: 'bulk_operation', action: '*' },
    { resource: 'bucket', action: '*' },
    { resource: 'calendar', action: '*' },
    { resource: 'chat', action: '*' },
    { resource: 'component', action: '*' },
    { resource: 'custom_field', action: '*' },
    { resource: 'dashboard_metrics', action: '*' },
    { resource: 'department', action: '*' },
    { resource: 'backlog', action: '*' },
    { resource: 'epic', action: '*' },
    { resource: 'issue_links', action: '*' },
    { resource: 'issue_type', action: '*' },
    { resource: 'issue_watcher', action: '*' },
    { resource: 'issue_hierarchy', action: '*' },
    { resource: 'issue_template', action: '*' },
    { resource: 'import_export', action: '*' },
    { resource: 'jql', action: '*' },
    { resource: 'location', action: '*' },
    { resource: 'notification', action: '*' },
    { resource: 'priority_scheme', action: '*' },
    { resource: 'project', action: '*' },
    { resource: 'report', action: '*' },
    { resource: 'sprint', action: '*' },
    { resource: 'saved_filter', action: '*' },
    { resource: 'task', action: '*' },
    { resource: 'task_checklist', action: '*' },
    { resource: 'task_comment', action: '*' },
    { resource: 'task_label', action: '*' },
    { resource: 'time_log', action: '*' },
    { resource: 'user', action: '*' },
    { resource: 'workflow', action: '*' },
    { resource: 'version', action: '*' },
  ],
  manager: [
    { resource: '*', action: 'read' },
    { resource: 'activity', action: 'read' },
    { resource: 'automation', action: '*' },
    { resource: 'bulk_operation', action: '*' },
    { resource: 'bucket', action: '*' },
    { resource: 'calendar', action: '*' },
    { resource: 'chat', action: '*' },
    { resource: 'component', action: '*' },
    { resource: 'custom_field', action: '*' },
    { resource: 'dashboard_metrics', action: '*' },
    { resource: 'backlog', action: '*' },
    { resource: 'epic', action: '*' },
    { resource: 'issue_links', action: '*' },
    { resource: 'issue_type', action: 'read' },
    { resource: 'issue_watcher', action: '*' },
    { resource: 'issue_hierarchy', action: '*' },
    { resource: 'issue_template', action: '*' },
    { resource: 'import_export', action: '*' },
    { resource: 'jql', action: '*' },
    { resource: 'notification', action: '*' },
    { resource: 'priority_scheme', action: '*' },
    { resource: 'project', action: '*' },
    { resource: 'report', action: '*' },
    { resource: 'sprint', action: '*' },
    { resource: 'saved_filter', action: '*' },
    { resource: 'task', action: '*' },
    { resource: 'task_checklist', action: '*' },
    { resource: 'task_comment', action: '*' },
    { resource: 'task_label', action: '*' },
    { resource: 'time_log', action: '*' },
    { resource: 'workflow', action: 'read' },
    { resource: 'version', action: '*' },
  ],
  contributor: [
    { resource: '*', action: 'read' },
    { resource: 'activity', action: 'read' },
    { resource: 'backlog', action: 'read' },
    { resource: 'bulk_operation', action: 'execute' },
    { resource: 'component', action: 'read' },
    { resource: 'custom_field', action: 'read' },
    { resource: 'epic', action: 'read' },
    { resource: 'issue_links', action: 'create' },
    { resource: 'issue_links', action: 'delete' },
    { resource: 'issue_links', action: 'read' },
    { resource: 'issue_type', action: 'read' },
    { resource: 'issue_watcher', action: 'create' },
    { resource: 'issue_watcher', action: 'delete' },
    { resource: 'issue_watcher', action: 'read' },
    { resource: 'issue_hierarchy', action: 'create' },
    { resource: 'issue_hierarchy', action: 'read' },
    { resource: 'issue_hierarchy', action: 'update' },
    { resource: 'issue_template', action: 'apply' },
    { resource: 'issue_template', action: 'read' },
    { resource: 'import_export', action: 'export' },
    { resource: 'import_export', action: 'import' },
    { resource: 'jql', action: 'read' },
    { resource: 'saved_filter', action: 'create' },
    { resource: 'saved_filter', action: 'delete' },
    { resource: 'saved_filter', action: 'read' },
    { resource: 'saved_filter', action: 'update' },
    { resource: 'dashboard_metrics', action: 'read' },
    { resource: 'dashboard_metrics', action: 'update' },
    { resource: 'priority_scheme', action: 'read' },
    { resource: 'report', action: 'export' },
    { resource: 'report', action: 'read' },
    { resource: 'sprint', action: 'read' },
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
    { resource: 'time_log', action: 'create' },
    { resource: 'time_log', action: 'delete' },
    { resource: 'time_log', action: 'read' },
    { resource: 'time_log', action: 'update' },
    { resource: 'chat', action: 'create' },
    { resource: 'chat', action: 'delete' },
    { resource: 'chat', action: 'read' },
    { resource: 'chat', action: 'update' },
    { resource: 'notification', action: 'read' },
    { resource: 'notification', action: 'update' },
    { resource: 'workflow', action: 'read' },
    { resource: 'workflow', action: 'execute' },
    { resource: 'version', action: 'read' },
  ],
  member: [
    { resource: '*', action: 'read' },
    { resource: 'activity', action: 'read' },
    { resource: 'backlog', action: 'read' },
    { resource: 'bulk_operation', action: 'execute' },
    { resource: 'component', action: 'read' },
    { resource: 'custom_field', action: 'read' },
    { resource: 'epic', action: 'read' },
    { resource: 'issue_links', action: 'create' },
    { resource: 'issue_links', action: 'delete' },
    { resource: 'issue_links', action: 'read' },
    { resource: 'issue_type', action: 'read' },
    { resource: 'issue_watcher', action: 'create' },
    { resource: 'issue_watcher', action: 'delete' },
    { resource: 'issue_watcher', action: 'read' },
    { resource: 'issue_hierarchy', action: 'create' },
    { resource: 'issue_hierarchy', action: 'read' },
    { resource: 'issue_hierarchy', action: 'update' },
    { resource: 'issue_template', action: 'apply' },
    { resource: 'issue_template', action: 'read' },
    { resource: 'import_export', action: 'export' },
    { resource: 'import_export', action: 'import' },
    { resource: 'jql', action: 'read' },
    { resource: 'saved_filter', action: 'create' },
    { resource: 'saved_filter', action: 'delete' },
    { resource: 'saved_filter', action: 'read' },
    { resource: 'saved_filter', action: 'update' },
    { resource: 'dashboard_metrics', action: 'read' },
    { resource: 'dashboard_metrics', action: 'update' },
    { resource: 'priority_scheme', action: 'read' },
    { resource: 'report', action: 'export' },
    { resource: 'report', action: 'read' },
    { resource: 'sprint', action: 'read' },
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
    { resource: 'time_log', action: 'create' },
    { resource: 'time_log', action: 'delete' },
    { resource: 'time_log', action: 'read' },
    { resource: 'time_log', action: 'update' },
    { resource: 'chat', action: 'create' },
    { resource: 'chat', action: 'delete' },
    { resource: 'chat', action: 'read' },
    { resource: 'chat', action: 'update' },
    { resource: 'notification', action: 'read' },
    { resource: 'notification', action: 'update' },
    { resource: 'workflow', action: 'read' },
    { resource: 'workflow', action: 'execute' },
    { resource: 'version', action: 'read' },
  ],
  viewer: [
    { resource: '*', action: 'read' },
    { resource: 'activity', action: 'read' },
    { resource: 'chat', action: 'read' },
    { resource: 'backlog', action: 'read' },
    { resource: 'component', action: 'read' },
    { resource: 'custom_field', action: 'read' },
    { resource: 'epic', action: 'read' },
    { resource: 'issue_links', action: 'read' },
    { resource: 'issue_type', action: 'read' },
    { resource: 'issue_watcher', action: 'read' },
    { resource: 'issue_hierarchy', action: 'read' },
    { resource: 'issue_template', action: 'read' },
    { resource: 'import_export', action: 'export' },
    { resource: 'jql', action: 'read' },
    { resource: 'notification', action: 'read' },
    { resource: 'notification', action: 'update' },
    { resource: 'dashboard_metrics', action: 'read' },
    { resource: 'priority_scheme', action: 'read' },
    { resource: 'report', action: 'export' },
    { resource: 'report', action: 'read' },
    { resource: 'sprint', action: 'read' },
    { resource: 'saved_filter', action: 'read' },
    { resource: 'time_log', action: 'read' },
    { resource: 'workflow', action: 'read' },
    { resource: 'version', action: 'read' },
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
