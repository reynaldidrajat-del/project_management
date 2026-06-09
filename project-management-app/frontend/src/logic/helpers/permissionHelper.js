const ROLE_ALIASES = {
  view: 'viewer',
};

const ROLE_PERMISSION_RULES = {
  super_admin: [{ resource: '*', action: '*' }],
  admin: [
    { resource: '*', action: 'read' },
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
    { resource: 'bulk_operation', action: 'execute' },
    { resource: 'import_export', action: 'export' },
    { resource: 'import_export', action: 'import' },
    { resource: 'issue_links', action: 'create' },
    { resource: 'issue_links', action: 'delete' },
    { resource: 'issue_watcher', action: 'create' },
    { resource: 'issue_watcher', action: 'delete' },
    { resource: 'issue_hierarchy', action: 'create' },
    { resource: 'issue_hierarchy', action: 'update' },
    { resource: 'issue_template', action: 'apply' },
    { resource: 'saved_filter', action: 'create' },
    { resource: 'saved_filter', action: 'delete' },
    { resource: 'saved_filter', action: 'update' },
    { resource: 'dashboard_metrics', action: 'update' },
    { resource: 'report', action: 'export' },
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
    { resource: 'time_log', action: 'update' },
    { resource: 'chat', action: 'create' },
    { resource: 'chat', action: 'delete' },
    { resource: 'chat', action: 'update' },
    { resource: 'notification', action: 'update' },
    { resource: 'workflow', action: 'execute' },
  ],
  member: [
    { resource: '*', action: 'read' },
    { resource: 'bulk_operation', action: 'execute' },
    { resource: 'import_export', action: 'export' },
    { resource: 'import_export', action: 'import' },
    { resource: 'issue_links', action: 'create' },
    { resource: 'issue_links', action: 'delete' },
    { resource: 'issue_watcher', action: 'create' },
    { resource: 'issue_watcher', action: 'delete' },
    { resource: 'issue_hierarchy', action: 'create' },
    { resource: 'issue_hierarchy', action: 'update' },
    { resource: 'issue_template', action: 'apply' },
    { resource: 'saved_filter', action: 'create' },
    { resource: 'saved_filter', action: 'delete' },
    { resource: 'saved_filter', action: 'update' },
    { resource: 'dashboard_metrics', action: 'update' },
    { resource: 'report', action: 'export' },
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
    { resource: 'time_log', action: 'update' },
    { resource: 'chat', action: 'create' },
    { resource: 'chat', action: 'delete' },
    { resource: 'chat', action: 'update' },
    { resource: 'notification', action: 'update' },
    { resource: 'workflow', action: 'execute' },
  ],
  viewer: [
    { resource: '*', action: 'read' },
    { resource: 'import_export', action: 'export' },
    { resource: 'notification', action: 'update' },
    { resource: 'report', action: 'export' },
  ],
};

export const normalizeRole = (role) => {
  const normalizedRole = String(role || 'viewer').trim().toLowerCase();
  return ROLE_ALIASES[normalizedRole] || normalizedRole;
};

const getUserRole = (userOrRole) => {
  if (typeof userOrRole === 'string') {
    return normalizeRole(userOrRole);
  }

  return normalizeRole(userOrRole?.role);
};

const ruleMatches = (rule, resource, action) => {
  const resourceMatches = rule.resource === '*' || rule.resource === resource;
  const actionMatches = rule.action === '*' || rule.action === action;

  return resourceMatches && actionMatches;
};

export const hasRolePermission = (userOrRole, resource, action) => {
  const role = getUserRole(userOrRole);
  const rules = ROLE_PERMISSION_RULES[role] || ROLE_PERMISSION_RULES.viewer;

  return rules.some((rule) => ruleMatches(rule, resource, action));
};
