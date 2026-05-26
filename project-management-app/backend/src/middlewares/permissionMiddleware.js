const { hasPermission } = require('../services/permissionService');
const { sendError } = require('../utils/responseUtils');

// Middleware role permission dasar. Business rule detail tetap dijaga di service domain.
const requirePermission = (resource, action) => async (req, res, next) => {
  try {
    const allowed = await hasPermission(req.user, resource, action);

    if (!allowed) {
      return sendError(res, 'User tidak memiliki izin untuk menjalankan aksi ini.', 'Akses ditolak.', 403);
    }

    return next();
  } catch (error) {
    return sendError(res, error, 'Akses ditolak.', 403);
  }
};

// Convenience middleware using permission string (e.g., 'manage_issue_types')
// Maps permission strings to resource/action pairs
const checkPermission = (permission) => {
  const permissionMap = {
    // Issue Type permissions
    manage_issue_types: { resource: 'issue_type', action: '*' },
    read_issue_types: { resource: 'issue_type', action: 'read' },
    
    // Workflow permissions
    manage_workflows: { resource: 'workflow', action: '*' },
    read_workflows: { resource: 'workflow', action: 'read' },
    execute_workflows: { resource: 'workflow', action: 'execute' },
    
    // Custom Field permissions
    manage_custom_fields: { resource: 'custom_field', action: '*' },
    read_custom_fields: { resource: 'custom_field', action: 'read' },
    
    // Sprint permissions
    manage_sprints: { resource: 'sprint', action: '*' },
    read_sprints: { resource: 'sprint', action: 'read' },
  };

  const mapping = permissionMap[permission];

  if (!mapping) {
    // If permission not found, default to checking the permission as a resource
    return requirePermission(permission, '*');
  }

  return requirePermission(mapping.resource, mapping.action);
};

module.exports = {
  checkPermission,
  requirePermission,
};
