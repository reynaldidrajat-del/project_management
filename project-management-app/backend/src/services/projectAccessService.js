const PROJECT_ADMIN_ROLES = new Set(['super_admin', 'admin']);

const normalizeRole = (role) => String(role || 'viewer').trim();

const normalizeUserId = (user) => {
  const userId = Number(user?.id);
  return Number.isInteger(userId) && userId > 0 ? userId : null;
};

const canViewAllProjects = (user) => PROJECT_ADMIN_ROLES.has(normalizeRole(user?.role));

const appendProjectVisibilityCondition = (
  conditions,
  values,
  user,
  {
    ownerIdExpression = 'p.owner_id',
    projectIdExpression = 'p.id',
  } = {},
) => {
  if (!user || canViewAllProjects(user)) {
    return;
  }

  const userId = normalizeUserId(user);

  if (!userId) {
    conditions.push('FALSE');
    return;
  }

  values.push(userId);
  const userParam = `$${values.length}`;

  conditions.push(`
    (
      ${ownerIdExpression} = ${userParam}
      OR EXISTS (
        SELECT 1
        FROM project_members project_access_member
        WHERE project_access_member.project_id = ${projectIdExpression}
          AND project_access_member.user_id = ${userParam}
      )
    )
  `);
};

module.exports = {
  appendProjectVisibilityCondition,
  canViewAllProjects,
};
