const { query } = require('../config/db');
const { logActivity } = require('./activityService');

const DEFAULT_PRIORITIES = [
  { name: 'Low', icon: 'arrow-down', color: 'green', sort_order: 0 },
  { name: 'Medium', icon: 'minus', color: 'blue', sort_order: 1 },
  { name: 'High', icon: 'arrow-up', color: 'orange', sort_order: 2 },
  { name: 'Urgent', icon: 'alert-triangle', color: 'red', sort_order: 3 },
];

const PRIORITY_SCHEME_SELECT = `
  SELECT
    ps.id,
    ps.name,
    ps.description,
    ps.priorities,
    ps.default_priority,
    ps.is_default,
    ps.created_by,
    creator.name AS created_by_name,
    ps.created_at,
    ps.updated_at
  FROM priority_schemes ps
  LEFT JOIN users creator ON creator.id = ps.created_by
`;

const normalizePositiveInteger = (value, fieldName = 'ID') => {
  const normalizedValue = Number(value);

  if (!Number.isInteger(normalizedValue) || normalizedValue <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }

  return normalizedValue;
};

const normalizePriorityName = (value) => String(value || '').trim();

const normalizePriorities = (priorities = DEFAULT_PRIORITIES) => {
  if (!Array.isArray(priorities) || priorities.length === 0) {
    throw new Error('Priority scheme requires at least one priority.');
  }

  const seenNames = new Set();

  return priorities.map((priority, index) => {
    const name = normalizePriorityName(priority.name || priority);

    if (!name) {
      throw new Error('Priority name is required.');
    }

    const key = name.toLowerCase();

    if (seenNames.has(key)) {
      throw new Error(`Duplicate priority "${name}" is not allowed.`);
    }

    seenNames.add(key);

    return {
      color: priority.color || 'slate',
      icon: priority.icon || 'circle',
      name,
      sort_order: Number.isInteger(Number(priority.sort_order)) ? Number(priority.sort_order) : index,
    };
  }).sort((a, b) => a.sort_order - b.sort_order);
};

const listPrioritySchemes = async () => {
  const result = await query(
    `
    ${PRIORITY_SCHEME_SELECT}
    ORDER BY ps.is_default DESC, ps.name ASC
    `,
  );

  return result.rows;
};

const getPrioritySchemeById = async (schemeId) => {
  const result = await query(
    `
    ${PRIORITY_SCHEME_SELECT}
    WHERE ps.id = $1
    `,
    [schemeId],
  );

  return result.rows[0] || null;
};

const getDefaultPriorityScheme = async () => {
  const result = await query(
    `
    ${PRIORITY_SCHEME_SELECT}
    WHERE ps.is_default = TRUE
    ORDER BY ps.id ASC
    LIMIT 1
    `,
  );

  if (result.rows[0]) {
    return result.rows[0];
  }

  const inserted = await query(
    `
    INSERT INTO priority_schemes (name, description, priorities, default_priority, is_default)
    VALUES ($1, $2, $3::JSONB, $4, TRUE)
    RETURNING id
    `,
    [
      'Default Priority Scheme',
      'Backward-compatible priority scheme for existing tasks.',
      JSON.stringify(DEFAULT_PRIORITIES),
      'Medium',
    ],
  );

  return getPrioritySchemeById(inserted.rows[0].id);
};

const getProjectPriorityScheme = async (projectId) => {
  const normalizedProjectId = normalizePositiveInteger(projectId, 'Project ID');
  const result = await query(
    `
    ${PRIORITY_SCHEME_SELECT}
    INNER JOIN project_priority_schemes pps ON pps.scheme_id = ps.id
    WHERE pps.project_id = $1
    `,
    [normalizedProjectId],
  );

  return result.rows[0] || getDefaultPriorityScheme();
};

const createPriorityScheme = async (payload = {}, context = {}) => {
  if (!payload.name || !String(payload.name).trim()) {
    throw new Error('Priority scheme name is required.');
  }

  const priorities = normalizePriorities(payload.priorities);
  const defaultPriority = normalizePriorityName(payload.default_priority || payload.defaultPriority || priorities[0].name);

  if (!priorities.some((priority) => priority.name.toLowerCase() === defaultPriority.toLowerCase())) {
    throw new Error('Default priority must exist in the priority list.');
  }

  const result = await query(
    `
    INSERT INTO priority_schemes (name, description, priorities, default_priority, is_default, created_by)
    VALUES ($1, $2, $3::JSONB, $4, $5, $6)
    RETURNING id
    `,
    [
      String(payload.name).trim(),
      payload.description || null,
      JSON.stringify(priorities),
      defaultPriority,
      Boolean(payload.is_default || payload.isDefault),
      context.actor_user_id || context.user_id || null,
    ],
  );

  const scheme = await getPrioritySchemeById(result.rows[0].id);

  await logActivity({
    actor_user_id: context.actor_user_id || context.user_id || null,
    action: 'priority_scheme.create',
    object_type: 'priority_scheme',
    object_id: scheme.id,
    description: `Priority scheme "${scheme.name}" created.`,
    metadata: { default_priority: scheme.default_priority },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  return scheme;
};

const updatePriorityScheme = async (schemeId, payload = {}, context = {}) => {
  const current = await getPrioritySchemeById(schemeId);

  if (!current) {
    throw new Error('Priority scheme not found.');
  }

  const priorities = payload.priorities === undefined ? current.priorities : normalizePriorities(payload.priorities);
  const defaultPriority = payload.default_priority === undefined && payload.defaultPriority === undefined
    ? current.default_priority
    : normalizePriorityName(payload.default_priority || payload.defaultPriority);

  if (!priorities.some((priority) => priority.name.toLowerCase() === defaultPriority.toLowerCase())) {
    throw new Error('Default priority must exist in the priority list.');
  }

  const result = await query(
    `
    UPDATE priority_schemes
    SET
      name = $1,
      description = $2,
      priorities = $3::JSONB,
      default_priority = $4,
      is_default = $5,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $6
    RETURNING id
    `,
    [
      payload.name === undefined ? current.name : String(payload.name).trim(),
      payload.description === undefined ? current.description : payload.description || null,
      JSON.stringify(priorities),
      defaultPriority,
      payload.is_default === undefined && payload.isDefault === undefined
        ? current.is_default
        : Boolean(payload.is_default || payload.isDefault),
      schemeId,
    ],
  );

  const scheme = await getPrioritySchemeById(result.rows[0].id);

  await logActivity({
    actor_user_id: context.actor_user_id || context.user_id || null,
    action: 'priority_scheme.update',
    object_type: 'priority_scheme',
    object_id: scheme.id,
    description: `Priority scheme "${scheme.name}" updated.`,
    metadata: { changed_fields: Object.keys(payload) },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  return scheme;
};

const deletePriorityScheme = async (schemeId, context = {}) => {
  const current = await getPrioritySchemeById(schemeId);

  if (!current) {
    throw new Error('Priority scheme not found.');
  }

  if (current.is_default) {
    throw new Error('Default priority scheme cannot be deleted.');
  }

  await query('DELETE FROM priority_schemes WHERE id = $1', [schemeId]);

  await logActivity({
    actor_user_id: context.actor_user_id || context.user_id || null,
    action: 'priority_scheme.delete',
    object_type: 'priority_scheme',
    object_id: Number(schemeId),
    description: `Priority scheme "${current.name}" deleted.`,
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  return { deleted_scheme_id: Number(schemeId) };
};

const assignPrioritySchemeToProject = async (projectId, schemeId, context = {}) => {
  const normalizedProjectId = normalizePositiveInteger(projectId, 'Project ID');
  const normalizedSchemeId = normalizePositiveInteger(schemeId, 'Scheme ID');

  const scheme = await getPrioritySchemeById(normalizedSchemeId);

  if (!scheme) {
    throw new Error('Priority scheme not found.');
  }

  const result = await query(
    `
    INSERT INTO project_priority_schemes (project_id, scheme_id, assigned_by)
    VALUES ($1, $2, $3)
    ON CONFLICT (project_id)
    DO UPDATE SET
      scheme_id = EXCLUDED.scheme_id,
      assigned_by = EXCLUDED.assigned_by,
      assigned_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
    `,
    [normalizedProjectId, normalizedSchemeId, context.actor_user_id || context.user_id || null],
  );

  await logActivity({
    actor_user_id: context.actor_user_id || context.user_id || null,
    project_id: normalizedProjectId,
    action: 'priority_scheme.assign',
    object_type: 'priority_scheme',
    object_id: normalizedSchemeId,
    description: `Priority scheme "${scheme.name}" assigned to project.`,
    metadata: { scheme_id: normalizedSchemeId },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  return result.rows[0];
};

const isPriorityAllowed = async (projectId, priority) => {
  if (!priority) {
    return true;
  }

  const normalizedPriority = normalizePriorityName(priority);
  const scheme = projectId ? await getProjectPriorityScheme(projectId) : await getDefaultPriorityScheme();

  return (scheme.priorities || []).some((item) => String(item.name || item).toLowerCase() === normalizedPriority.toLowerCase());
};

const ensurePriorityAllowed = async (projectId, priority) => {
  if (!(await isPriorityAllowed(projectId, priority))) {
    throw new Error('Priority task tidak valid untuk priority scheme project.');
  }
};

module.exports = {
  DEFAULT_PRIORITIES,
  assignPrioritySchemeToProject,
  createPriorityScheme,
  deletePriorityScheme,
  ensurePriorityAllowed,
  getDefaultPriorityScheme,
  getPrioritySchemeById,
  getProjectPriorityScheme,
  isPriorityAllowed,
  listPrioritySchemes,
  updatePriorityScheme,
};
