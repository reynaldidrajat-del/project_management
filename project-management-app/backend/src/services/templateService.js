const { query } = require('../config/db');
const { logActivity } = require('./activityService');
const { createTaskChecklist } = require('./taskChecklistService');
const { createTask, getTaskById } = require('./taskService');

const TEMPLATE_SELECT = `
  SELECT
    it.id,
    it.project_id,
    p.name AS project_name,
    it.name,
    it.description,
    it.issue_type_id,
    issue_type.name AS issue_type_name,
    it.fields,
    it.subtasks,
    it.checklists,
    it.is_shared,
    it.is_active,
    it.created_by,
    creator.name AS created_by_name,
    it.created_at,
    it.updated_at
  FROM issue_templates it
  LEFT JOIN projects p ON p.id = it.project_id
  LEFT JOIN issue_types issue_type ON issue_type.id = it.issue_type_id
  LEFT JOIN users creator ON creator.id = it.created_by
`;

const normalizePositiveInteger = (value, fieldName = 'ID') => {
  const normalizedValue = Number(value);

  if (!Number.isInteger(normalizedValue) || normalizedValue <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }

  return normalizedValue;
};

const normalizeJsonArray = (value) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (!value) {
    return [];
  }

  return [value];
};

const listTemplates = async (filters = {}) => {
  const values = [];
  const conditions = ['it.is_active = TRUE'];

  if (filters.include_inactive === 'true' || filters.includeInactive === 'true') {
    conditions.length = 0;
  }

  if (filters.project_id || filters.projectId) {
    values.push(normalizePositiveInteger(filters.project_id || filters.projectId, 'Project ID'));
    conditions.push(`(it.project_id = $${values.length} OR it.project_id IS NULL OR it.is_shared = TRUE)`);
  }

  if (filters.issue_type_id || filters.issueTypeId) {
    values.push(normalizePositiveInteger(filters.issue_type_id || filters.issueTypeId, 'Issue Type ID'));
    conditions.push(`(it.issue_type_id = $${values.length} OR it.issue_type_id IS NULL)`);
  }

  const result = await query(
    `
    ${TEMPLATE_SELECT}
    ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
    ORDER BY it.is_shared DESC, it.name ASC
    `,
    values,
  );

  return result.rows;
};

const getTemplateById = async (templateId) => {
  const result = await query(
    `
    ${TEMPLATE_SELECT}
    WHERE it.id = $1
    `,
    [templateId],
  );

  return result.rows[0] || null;
};

const validateTemplatePayload = (payload = {}, partial = false) => {
  if (!partial && (!payload.name || !String(payload.name).trim())) {
    throw new Error('Template name is required.');
  }

  if (payload.fields !== undefined && (payload.fields === null || typeof payload.fields !== 'object' || Array.isArray(payload.fields))) {
    throw new Error('Template fields must be an object.');
  }
};

const createTemplate = async (payload = {}, context = {}) => {
  validateTemplatePayload(payload);

  const result = await query(
    `
    INSERT INTO issue_templates (
      project_id,
      name,
      description,
      issue_type_id,
      fields,
      subtasks,
      checklists,
      is_shared,
      is_active,
      created_by
    )
    VALUES ($1, $2, $3, $4, $5::JSONB, $6::JSONB, $7::JSONB, $8, $9, $10)
    RETURNING id
    `,
    [
      payload.project_id || payload.projectId || null,
      String(payload.name).trim(),
      payload.description || null,
      payload.issue_type_id || payload.issueTypeId || null,
      JSON.stringify(payload.fields || {}),
      JSON.stringify(normalizeJsonArray(payload.subtasks)),
      JSON.stringify(normalizeJsonArray(payload.checklists)),
      Boolean(payload.is_shared || payload.isShared),
      payload.is_active === undefined && payload.isActive === undefined ? true : Boolean(payload.is_active || payload.isActive),
      context.actor_user_id || context.user_id || null,
    ],
  );

  const template = await getTemplateById(result.rows[0].id);

  await logActivity({
    actor_user_id: context.actor_user_id || context.user_id || null,
    project_id: template.project_id,
    action: 'issue_template.create',
    object_type: 'issue_template',
    object_id: template.id,
    description: `Issue template "${template.name}" created.`,
    metadata: { is_shared: template.is_shared },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  return template;
};

const updateTemplate = async (templateId, payload = {}, context = {}) => {
  const current = await getTemplateById(templateId);

  if (!current) {
    throw new Error('Issue template not found.');
  }

  validateTemplatePayload(payload, true);

  const result = await query(
    `
    UPDATE issue_templates
    SET
      project_id = $1,
      name = $2,
      description = $3,
      issue_type_id = $4,
      fields = $5::JSONB,
      subtasks = $6::JSONB,
      checklists = $7::JSONB,
      is_shared = $8,
      is_active = $9,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $10
    RETURNING id
    `,
    [
      payload.project_id === undefined && payload.projectId === undefined ? current.project_id : payload.project_id || payload.projectId || null,
      payload.name === undefined ? current.name : String(payload.name).trim(),
      payload.description === undefined ? current.description : payload.description || null,
      payload.issue_type_id === undefined && payload.issueTypeId === undefined ? current.issue_type_id : payload.issue_type_id || payload.issueTypeId || null,
      JSON.stringify(payload.fields === undefined ? current.fields : payload.fields || {}),
      JSON.stringify(payload.subtasks === undefined ? current.subtasks : normalizeJsonArray(payload.subtasks)),
      JSON.stringify(payload.checklists === undefined ? current.checklists : normalizeJsonArray(payload.checklists)),
      payload.is_shared === undefined && payload.isShared === undefined ? current.is_shared : Boolean(payload.is_shared || payload.isShared),
      payload.is_active === undefined && payload.isActive === undefined ? current.is_active : Boolean(payload.is_active || payload.isActive),
      templateId,
    ],
  );

  const template = await getTemplateById(result.rows[0].id);

  await logActivity({
    actor_user_id: context.actor_user_id || context.user_id || null,
    project_id: template.project_id,
    action: 'issue_template.update',
    object_type: 'issue_template',
    object_id: template.id,
    description: `Issue template "${template.name}" updated.`,
    metadata: { changed_fields: Object.keys(payload) },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  return template;
};

const deleteTemplate = async (templateId, context = {}) => {
  const template = await getTemplateById(templateId);

  if (!template) {
    throw new Error('Issue template not found.');
  }

  await query('UPDATE issue_templates SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [templateId]);

  await logActivity({
    actor_user_id: context.actor_user_id || context.user_id || null,
    project_id: template.project_id,
    action: 'issue_template.delete',
    object_type: 'issue_template',
    object_id: Number(templateId),
    description: `Issue template "${template.name}" archived.`,
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  return { archived_template_id: Number(templateId) };
};

const buildIssuePayloadFromTemplate = (template, overrides = {}) => {
  const fields = template.fields || {};

  return {
    ...fields,
    ...overrides,
    issue_type_id: overrides.issue_type_id || overrides.issueTypeId || fields.issue_type_id || template.issue_type_id || null,
    project_id: overrides.project_id || overrides.projectId || fields.project_id || template.project_id,
  };
};

const previewTemplateApplication = async (templateId, overrides = {}) => {
  const template = await getTemplateById(templateId);

  if (!template || !template.is_active) {
    throw new Error('Issue template not found.');
  }

  return {
    checklists: template.checklists || [],
    issue_payload: buildIssuePayloadFromTemplate(template, overrides),
    subtasks: template.subtasks || [],
    template,
  };
};

const createIssueFromTemplate = async (templateId, overrides = {}, context = {}) => {
  const preview = await previewTemplateApplication(templateId, overrides);
  const parentIssue = await createTask(preview.issue_payload, context);
  const createdSubtasks = [];
  const createdChecklists = [];

  for (const checklist of preview.checklists) {
    createdChecklists.push(await createTaskChecklist(parentIssue.id, checklist, context));
  }

  for (const subtaskTemplate of preview.subtasks) {
    const subtaskPayload = {
      ...subtaskTemplate,
      parent_task_id: parentIssue.id,
      project_id: parentIssue.project_id,
      sprint_id: subtaskTemplate.sprint_id || parentIssue.sprint_id || null,
      epic_id: subtaskTemplate.epic_id || parentIssue.epic_id || null,
    };
    const subtask = await createTask(subtaskPayload, context);
    const subtaskChecklists = normalizeJsonArray(subtaskTemplate.checklists);

    for (const checklist of subtaskChecklists) {
      await createTaskChecklist(subtask.id, checklist, context);
    }

    createdSubtasks.push(subtask);
  }

  await logActivity({
    actor_user_id: context.actor_user_id || context.user_id || null,
    project_id: parentIssue.project_id,
    task_id: parentIssue.id,
    action: 'issue_template.apply',
    object_type: 'issue_template',
    object_id: preview.template.id,
    description: `Issue template "${preview.template.name}" applied.`,
    metadata: {
      created_subtask_count: createdSubtasks.length,
      template_id: preview.template.id,
    },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  return {
    checklists: createdChecklists,
    issue: await getTaskById(parentIssue.id),
    subtasks: createdSubtasks,
    template: preview.template,
  };
};

module.exports = {
  createIssueFromTemplate,
  createTemplate,
  deleteTemplate,
  getTemplateById,
  listTemplates,
  previewTemplateApplication,
  updateTemplate,
};
