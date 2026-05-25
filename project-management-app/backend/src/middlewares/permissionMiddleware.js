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

module.exports = {
  requirePermission,
};
