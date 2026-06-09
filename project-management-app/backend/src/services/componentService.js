const { query } = require('../config/db');
const { logActivity } = require('./activityService');

const COMPONENT_SELECT = `
  SELECT
    c.id,
    c.project_id,
    p.name AS project_name,
    c.name,
    c.description,
    c.default_assignee_id,
    default_assignee.name AS default_assignee_name,
    default_assignee.email AS default_assignee_email,
    c.created_at,
    c.updated_at,
    COALESCE(component_metrics.issue_count, 0)::INTEGER AS issue_count,
    COALESCE(component_metrics.completed_issue_count, 0)::INTEGER AS completed_issue_count,
    CASE
      WHEN COALESCE(component_metrics.issue_count, 0) = 0 THEN 0
      ELSE ROUND((component_metrics.completed_issue_count::NUMERIC / component_metrics.issue_count::NUMERIC) * 100)::INTEGER
    END AS completion_rate
  FROM components c
  INNER JOIN projects p ON p.id = c.project_id
  LEFT JOIN users default_assignee ON default_assignee.id = c.default_assignee_id
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*)::INTEGER AS issue_count,
      COUNT(*) FILTER (WHERE t.status = 'Done')::INTEGER AS completed_issue_count
    FROM issue_components ic
    INNER JOIN tasks t ON t.id = ic.issue_id
    WHERE ic.component_id = c.id
  ) component_metrics ON TRUE
`;

const normalizeComponentIds = (componentIds) => {
  if (!Array.isArray(componentIds)) {
    throw new Error('Component IDs must be provided as an array.');
  }

  return [
    ...new Set(
      componentIds
        .map((componentId) => Number(componentId))
        .filter((componentId) => Number.isInteger(componentId) && componentId > 0),
    ),
  ];
};

const getComponentIdsFromPayload = (payload = {}) => {
  return payload.component_ids !== undefined ? payload.component_ids : payload.componentIds;
};

const ensureProjectExists = async (projectId) => {
  const result = await query('SELECT id FROM projects WHERE id = $1', [projectId]);

  if (!result.rows[0]) {
    throw new Error('Project not found.');
  }
};

const ensureUserExists = async (userId) => {
  if (!userId) {
    return null;
  }

  const result = await query('SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL', [userId]);

  if (!result.rows[0]) {
    throw new Error('Default assignee not found.');
  }

  return Number(userId);
};

const ensureProjectComponentVisibility = async (projectId, context = {}) => {
  const actorRole = context.actor_role || context.user_role;
  const actorUserId = context.actor_user_id || context.user_id;
  const elevatedRoles = new Set(['super_admin', 'admin', 'manager']);

  if (elevatedRoles.has(actorRole)) {
    return true;
  }

  if (!actorUserId) {
    throw new Error('User login not found.');
  }

  const result = await query(
    `
    SELECT 1
    FROM projects p
    WHERE p.id = $1
      AND (
        p.owner_id = $2
        OR EXISTS (
          SELECT 1
          FROM project_members pm
          WHERE pm.project_id = p.id
            AND pm.user_id = $2
        )
      )
    `,
    [projectId, actorUserId],
  );

  if (!result.rows[0]) {
    throw new Error('User does not have access to this project component scope.');
  }

  return true;
};

const getIssueById = async (issueId) => {
  const result = await query(
    `
    SELECT id, project_id, title, issue_key, assignee_id
    FROM tasks
    WHERE id = $1
    `,
    [issueId],
  );

  return result.rows[0] || null;
};

const getIssueAssigneeIds = async (issueId, fallbackAssigneeId = null) => {
  const result = await query(
    `
    SELECT user_id
    FROM task_assignees
    WHERE task_id = $1
    ORDER BY id
    `,
    [issueId],
  );

  const assigneeIds = result.rows.map((row) => Number(row.user_id)).filter(Boolean);

  if (assigneeIds.length) {
    return [...new Set(assigneeIds)];
  }

  return fallbackAssigneeId ? [Number(fallbackAssigneeId)] : [];
};

const upsertTaskAssignees = async (issueId, userIds = []) => {
  const normalizedUserIds = [...new Set(userIds.map(Number).filter(Boolean))];

  for (const userId of normalizedUserIds) {
    await query(
      `
      INSERT INTO task_assignees (task_id, user_id)
      VALUES ($1, $2)
      ON CONFLICT (task_id, user_id) DO NOTHING
      `,
      [issueId, userId],
    );
  }

  if (normalizedUserIds.length > 0) {
    await query(
      `
      UPDATE tasks
      SET assignee_id = COALESCE(assignee_id, $1),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      `,
      [normalizedUserIds[0], issueId],
    );
  }

  return normalizedUserIds;
};

const upsertProjectMembers = async (projectId, userIds = []) => {
  for (const userId of userIds) {
    await query(
      `
      INSERT INTO project_members (project_id, user_id, role)
      VALUES ($1, $2, 'member')
      ON CONFLICT (project_id, user_id) DO NOTHING
      `,
      [projectId, userId],
    );
  }
};

const validateComponentsForProject = async (projectId, componentIds) => {
  const normalizedComponentIds = normalizeComponentIds(componentIds);

  if (!normalizedComponentIds.length) {
    return [];
  }

  const result = await query(
    `
    SELECT id, project_id, name, default_assignee_id
    FROM components
    WHERE id = ANY($1::INTEGER[])
    ORDER BY name
    `,
    [normalizedComponentIds],
  );

  if (result.rowCount !== normalizedComponentIds.length) {
    throw new Error('One or more components were not found.');
  }

  const crossProjectComponent = result.rows.find((component) => Number(component.project_id) !== Number(projectId));

  if (crossProjectComponent) {
    throw new Error('All components must belong to the same project as the issue.');
  }

  return result.rows;
};

const listComponents = async (projectId) => {
  if (!projectId) {
    throw new Error('Project ID is required.');
  }

  const result = await query(
    `
    ${COMPONENT_SELECT}
    WHERE c.project_id = $1
    ORDER BY c.name ASC
    `,
    [projectId],
  );

  return result.rows;
};

const getComponentById = async (id) => {
  const result = await query(
    `
    ${COMPONENT_SELECT}
    WHERE c.id = $1
    `,
    [id],
  );

  return result.rows[0] || null;
};

const createComponent = async (payload = {}, context = {}) => {
  if (!payload.project_id) {
    throw new Error('Project ID is required.');
  }

  if (!payload.name || !String(payload.name).trim()) {
    throw new Error('Component name is required.');
  }

  await ensureProjectExists(payload.project_id);
  const defaultAssigneeId = await ensureUserExists(payload.default_assignee_id || payload.defaultAssigneeId || null);

  const result = await query(
    `
    INSERT INTO components (project_id, name, description, default_assignee_id)
    VALUES ($1, $2, $3, $4)
    RETURNING id
    `,
    [
      payload.project_id,
      String(payload.name).trim(),
      payload.description || null,
      defaultAssigneeId,
    ],
  );

  const component = await getComponentById(result.rows[0].id);

  await logActivity({
    actor_user_id: context.actor_user_id || null,
    project_id: component.project_id,
    action: 'component.create',
    object_type: 'component',
    object_id: component.id,
    description: `Component "${component.name}" created.`,
    metadata: { name: component.name, default_assignee_id: defaultAssigneeId },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  return component;
};

const updateComponent = async (id, payload = {}, context = {}) => {
  const existing = await getComponentById(id);

  if (!existing) {
    throw new Error('Component not found.');
  }

  if (payload.name !== undefined && !String(payload.name).trim()) {
    throw new Error('Component name is required.');
  }

  const defaultAssigneeId = payload.default_assignee_id !== undefined || payload.defaultAssigneeId !== undefined
    ? await ensureUserExists(payload.default_assignee_id || payload.defaultAssigneeId || null)
    : existing.default_assignee_id;

  await query(
    `
    UPDATE components
    SET name = $1,
        description = $2,
        default_assignee_id = $3,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $4
    `,
    [
      payload.name === undefined ? existing.name : String(payload.name).trim(),
      payload.description === undefined ? existing.description : payload.description || null,
      defaultAssigneeId,
      id,
    ],
  );

  const component = await getComponentById(id);

  await logActivity({
    actor_user_id: context.actor_user_id || null,
    project_id: component.project_id,
    action: 'component.update',
    object_type: 'component',
    object_id: component.id,
    description: `Component "${component.name}" updated.`,
    metadata: { changed_fields: Object.keys(payload || {}) },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  return component;
};

const deleteComponent = async (id, context = {}) => {
  const existing = await getComponentById(id);

  if (!existing) {
    throw new Error('Component not found.');
  }

  await query('DELETE FROM components WHERE id = $1', [id]);

  await logActivity({
    actor_user_id: context.actor_user_id || null,
    project_id: existing.project_id,
    action: 'component.delete',
    object_type: 'component',
    object_id: Number(id),
    description: `Component "${existing.name}" deleted.`,
    metadata: { name: existing.name },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  return { id: Number(id), name: existing.name };
};

const getIssueComponents = async (issueId) => {
  const issue = await getIssueById(issueId);

  if (!issue) {
    throw new Error('Issue not found.');
  }

  const result = await query(
    `
    SELECT
      c.id,
      c.project_id,
      c.name,
      c.description,
      c.default_assignee_id,
      default_assignee.name AS default_assignee_name
    FROM issue_components ic
    INNER JOIN components c ON c.id = ic.component_id
    LEFT JOIN users default_assignee ON default_assignee.id = c.default_assignee_id
    WHERE ic.issue_id = $1
    ORDER BY c.name ASC
    `,
    [issueId],
  );

  return result.rows;
};

const getIssueComponentProjectId = async (issueId) => {
  const issue = await getIssueById(issueId);

  if (!issue) {
    throw new Error('Issue not found.');
  }

  return issue.project_id;
};

const replaceIssueComponents = async (issueId, componentIds = [], options = {}) => {
  const issue = await getIssueById(issueId);

  if (!issue) {
    throw new Error('Issue not found.');
  }

  const normalizedComponentIds = normalizeComponentIds(componentIds);
  const components = await validateComponentsForProject(issue.project_id, normalizedComponentIds);

  await query('DELETE FROM issue_components WHERE issue_id = $1', [issueId]);

  for (const componentId of normalizedComponentIds) {
    await query(
      `
      INSERT INTO issue_components (issue_id, component_id)
      VALUES ($1, $2)
      ON CONFLICT (issue_id, component_id) DO NOTHING
      `,
      [issueId, componentId],
    );
  }

  const defaultAssigneeIds = components
    .map((component) => Number(component.default_assignee_id))
    .filter(Boolean);

  let autoAssignedUserIds = [];

  if (options.applyDefaultAssignee !== false && defaultAssigneeIds.length > 0) {
    const currentAssigneeIds = await getIssueAssigneeIds(issueId, issue.assignee_id);

    if (currentAssigneeIds.length === 0) {
      autoAssignedUserIds = await upsertTaskAssignees(issueId, defaultAssigneeIds);
      await upsertProjectMembers(issue.project_id, autoAssignedUserIds);
    }
  }

  await logActivity({
    actor_user_id: options.actor_user_id || null,
    task_id: Number(issueId),
    project_id: issue.project_id,
    action: 'component.issue.assign',
    object_type: 'issue',
    object_id: Number(issueId),
    description: `Components updated for issue "${issue.issue_key || issue.title}".`,
    metadata: {
      component_ids: normalizedComponentIds,
      auto_assigned_user_ids: autoAssignedUserIds,
    },
    ip_address: options.ip_address,
    user_agent: options.user_agent,
  });

  return {
    issue_id: Number(issueId),
    component_ids: normalizedComponentIds,
    components: await getIssueComponents(issueId),
    auto_assigned_user_ids: autoAssignedUserIds,
  };
};

const getComponentMetrics = async (id) => {
  const component = await getComponentById(id);

  if (!component) {
    throw new Error('Component not found.');
  }

  const statusResult = await query(
    `
    SELECT
      t.status,
      COUNT(*)::INTEGER AS issue_count
    FROM issue_components ic
    INNER JOIN tasks t ON t.id = ic.issue_id
    WHERE ic.component_id = $1
    GROUP BY t.status
    ORDER BY t.status
    `,
    [id],
  );

  return {
    component_id: component.id,
    project_id: component.project_id,
    issue_count: component.issue_count,
    completed_issue_count: component.completed_issue_count,
    completion_rate: component.completion_rate,
    by_status: statusResult.rows,
  };
};

module.exports = {
  createComponent,
  deleteComponent,
  ensureProjectComponentVisibility,
  getComponentById,
  getComponentIdsFromPayload,
  getComponentMetrics,
  getIssueComponentProjectId,
  getIssueComponents,
  listComponents,
  replaceIssueComponents,
  updateComponent,
};
