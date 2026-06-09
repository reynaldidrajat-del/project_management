const { query } = require('../config/db');
const { logActivity } = require('./activityService');
const { hasPermission } = require('./permissionService');
const { buildJqlQuery } = require('./jqlService');
const { VALID_PRIORITIES, VALID_STATUSES, createTask } = require('./taskService');

const EXPORT_FORMATS = {
  CSV: 'csv',
  EXCEL: 'excel',
  JSON: 'json',
};

const MAX_IMPORT_ROWS = 1000;
const MAX_EXPORT_ROWS = 5000;
const EXPORT_MIME_TYPES = {
  [EXPORT_FORMATS.CSV]: 'text/csv;charset=utf-8',
  [EXPORT_FORMATS.EXCEL]: 'application/vnd.ms-excel;charset=utf-8',
  [EXPORT_FORMATS.JSON]: 'application/json;charset=utf-8',
};

const IMPORT_FIELD_DEFINITIONS = [
  { aliases: ['title', 'summary', 'name'], key: 'title', required: true },
  { aliases: ['description', 'details'], key: 'description' },
  { aliases: ['project_id', 'project id', 'project'], key: 'project_id' },
  { aliases: ['project_name', 'project name'], key: 'project_name' },
  { aliases: ['issue_type_id', 'issue type id', 'type_id'], key: 'issue_type_id' },
  { aliases: ['issue_type_name', 'issue type', 'type', 'issuetype'], key: 'issue_type_name' },
  { aliases: ['status'], key: 'status' },
  { aliases: ['priority'], key: 'priority' },
  { aliases: ['assignee_id', 'assignee id'], key: 'assignee_id' },
  { aliases: ['assignee_ids', 'assignee ids', 'pic_ids', 'pic ids'], key: 'assignee_ids' },
  { aliases: ['assignee_email', 'assignee email', 'pic_email', 'pic email'], key: 'assignee_email' },
  { aliases: ['lead_id', 'lead id'], key: 'lead_id' },
  { aliases: ['start_date', 'start date'], key: 'start_date' },
  { aliases: ['end_date', 'end date', 'due_date', 'due date'], key: 'end_date' },
  { aliases: ['progress'], key: 'progress' },
  { aliases: ['story_points', 'story points', 'points'], key: 'story_points' },
  { aliases: ['epic_id', 'epic id'], key: 'epic_id' },
  { aliases: ['sprint_id', 'sprint id'], key: 'sprint_id' },
  { aliases: ['bucket_id', 'bucket id'], key: 'bucket_id' },
  { aliases: ['resolution'], key: 'resolution' },
  { aliases: ['environment'], key: 'environment' },
];

const STANDARD_EXPORT_COLUMNS = [
  { key: 'issue_key', label: 'Issue Key' },
  { key: 'title', label: 'Title' },
  { key: 'description', label: 'Description' },
  { key: 'project_name', label: 'Project' },
  { key: 'project_key', label: 'Project Key' },
  { key: 'issue_type_name', label: 'Issue Type' },
  { key: 'status', label: 'Status' },
  { key: 'workflow_state_name', label: 'Workflow State' },
  { key: 'priority', label: 'Priority' },
  { key: 'assignee_names', label: 'Assignees' },
  { key: 'lead_name', label: 'Lead' },
  { key: 'start_date', label: 'Start Date' },
  { key: 'end_date', label: 'End Date' },
  { key: 'progress', label: 'Progress' },
  { key: 'story_points', label: 'Story Points' },
  { key: 'epic_name', label: 'Epic' },
  { key: 'sprint_name', label: 'Sprint' },
  { key: 'bucket_name', label: 'Bucket' },
  { key: 'resolution', label: 'Resolution' },
  { key: 'environment', label: 'Environment', sensitive: true },
  { key: 'created_at', label: 'Created At' },
  { key: 'updated_at', label: 'Updated At' },
];

const ELEVATED_ROLES = new Set(['super_admin', 'admin', 'manager']);

const normalizeRole = (role) => String(role || 'viewer').trim();

const normalizePositiveInteger = (value) => {
  const normalizedValue = Number(value);
  return Number.isInteger(normalizedValue) && normalizedValue > 0 ? normalizedValue : null;
};

const normalizeExportLimit = (value) => {
  const normalizedValue = Number(value || MAX_EXPORT_ROWS);

  if (!Number.isInteger(normalizedValue) || normalizedValue <= 0) {
    return MAX_EXPORT_ROWS;
  }

  return Math.min(normalizedValue, MAX_EXPORT_ROWS);
};

const normalizeBoolean = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  return ['true', '1', 'yes'].includes(String(value).trim().toLowerCase());
};

const normalizeString = (value) => (value === undefined || value === null ? '' : String(value).trim());

const normalizeHeader = (value) =>
  normalizeString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const splitMultiValue = (value) =>
  normalizeString(value)
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);

const parseCsv = (text = '') => {
  const rows = [];
  let currentRow = [];
  let currentCell = '';
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      currentCell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === ',' && !insideQuotes) {
      currentRow.push(currentCell);
      currentCell = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        index += 1;
      }

      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = '';
      continue;
    }

    currentCell += char;
  }

  currentRow.push(currentCell);
  rows.push(currentRow);

  const nonEmptyRows = rows.filter((row) => row.some((cell) => normalizeString(cell)));
  const headers = (nonEmptyRows[0] || []).map((header) => normalizeString(header)).filter(Boolean);

  if (!headers.length) {
    return { headers: [], rows: [] };
  }

  return {
    headers,
    rows: nonEmptyRows.slice(1).map((row) =>
      Object.fromEntries(headers.map((header, index) => [header, normalizeString(row[index])]))
    ),
  };
};

const parseJsonIssues = (content) => {
  const parsed = typeof content === 'string' ? JSON.parse(content) : content;
  const rows = Array.isArray(parsed) ? parsed : parsed?.issues;

  if (!Array.isArray(rows)) {
    throw new Error('JSON harus berupa array issue atau object dengan property issues.');
  }

  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row || {}).forEach((key) => set.add(key));
      return set;
    }, new Set()),
  );

  return { headers, rows };
};

const parseImportRows = ({ content, format, issues }) => {
  if (Array.isArray(issues)) {
    return parseJsonIssues({ issues });
  }

  if (!content && content !== '') {
    throw new Error('Konten import wajib dikirim.');
  }

  const normalizedFormat = normalizeString(format).toLowerCase();

  if (normalizedFormat === EXPORT_FORMATS.JSON) {
    return parseJsonIssues(content);
  }

  if (normalizedFormat === EXPORT_FORMATS.CSV || !normalizedFormat) {
    return parseCsv(content);
  }

  throw new Error('Format import tidak valid.');
};

const getMappedImportValue = (row, headersByNormalizedName, fieldMapping, fieldKey) => {
  const sourceField = fieldMapping[fieldKey];

  if (sourceField && row[sourceField] !== undefined && row[sourceField] !== null) {
    return normalizeString(row[sourceField]);
  }

  const fieldDefinition = IMPORT_FIELD_DEFINITIONS.find((field) => field.key === fieldKey);
  const matchedHeader = fieldDefinition?.aliases
    .map((alias) => headersByNormalizedName.get(normalizeHeader(alias)))
    .find(Boolean);

  if (matchedHeader && row[matchedHeader] !== undefined && row[matchedHeader] !== null) {
    return normalizeString(row[matchedHeader]);
  }

  if (row[fieldKey] !== undefined && row[fieldKey] !== null) {
    return normalizeString(row[fieldKey]);
  }

  return '';
};

const getCustomFieldTargetName = (targetField) => {
  const value = normalizeString(targetField);
  const bracketMatch = value.match(/^cf\[(.+)\]$/i);

  if (bracketMatch) {
    return bracketMatch[1].trim();
  }

  if (/^custom[_.:]/i.test(value)) {
    return value.replace(/^custom[_.:]/i, '').trim();
  }

  return '';
};

const getMappedCustomFieldValues = (row, fieldMapping = {}) => {
  const values = {};

  Object.entries(fieldMapping || {}).forEach(([targetField, sourceField]) => {
    const customFieldName = getCustomFieldTargetName(targetField);

    if (!customFieldName || !sourceField || row[sourceField] === undefined || row[sourceField] === null) {
      return;
    }

    values[customFieldName] = normalizeString(row[sourceField]);
  });

  Object.entries(row.custom_fields || row.customFields || {}).forEach(([customFieldName, value]) => {
    values[customFieldName] = normalizeString(value);
  });

  Object.entries(row || {}).forEach(([sourceField, value]) => {
    const customFieldName = getCustomFieldTargetName(sourceField);

    if (customFieldName) {
      values[customFieldName] = normalizeString(value);
    }
  });

  return values;
};

const resolveProjectId = async ({ cache, projectId, projectName }) => {
  const normalizedProjectId = normalizePositiveInteger(projectId);

  if (normalizedProjectId) {
    return normalizedProjectId;
  }

  const normalizedProjectName = normalizeString(projectName);

  if (!normalizedProjectName) {
    return null;
  }

  const cacheKey = normalizedProjectName.toLowerCase();

  if (cache.projectsByName.has(cacheKey)) {
    return cache.projectsByName.get(cacheKey);
  }

  const result = await query(
    `
      SELECT id
      FROM projects
      WHERE lower(name) = lower($1)
        OR lower(COALESCE(project_key, '')) = lower($1)
      LIMIT 1
    `,
    [normalizedProjectName],
  );
  const resolvedProjectId = result.rows[0]?.id || null;

  cache.projectsByName.set(cacheKey, resolvedProjectId);
  return resolvedProjectId;
};

const resolveIssueTypeId = async ({ cache, issueTypeId, issueTypeName, projectId }) => {
  const normalizedIssueTypeId = normalizePositiveInteger(issueTypeId);

  if (normalizedIssueTypeId) {
    return normalizedIssueTypeId;
  }

  const normalizedIssueTypeName = normalizeString(issueTypeName);

  if (!normalizedIssueTypeName || !projectId) {
    return null;
  }

  const cacheKey = `${projectId}:${normalizedIssueTypeName.toLowerCase()}`;

  if (cache.issueTypesByName.has(cacheKey)) {
    return cache.issueTypesByName.get(cacheKey);
  }

  const result = await query(
    `
      SELECT id
      FROM issue_types
      WHERE lower(name) = lower($1)
        AND (project_id = $2 OR project_id IS NULL OR is_system = TRUE)
      ORDER BY
        CASE WHEN project_id = $2 THEN 0 ELSE 1 END,
        is_system DESC,
        id
      LIMIT 1
    `,
    [normalizedIssueTypeName, projectId],
  );
  const resolvedIssueTypeId = result.rows[0]?.id || null;

  cache.issueTypesByName.set(cacheKey, resolvedIssueTypeId);
  return resolvedIssueTypeId;
};

const resolveUserIds = async ({ cache, assigneeIdsValue, assigneeEmailValue }) => {
  const explicitIds = splitMultiValue(assigneeIdsValue)
    .map((value) => normalizePositiveInteger(value))
    .filter(Boolean);
  const lookupValues = splitMultiValue(assigneeEmailValue);

  if (!lookupValues.length) {
    return Array.from(new Set(explicitIds));
  }

  const resolvedIds = [];

  for (const lookupValue of lookupValues) {
    const cacheKey = lookupValue.toLowerCase();

    if (!cache.usersByLookup.has(cacheKey)) {
      const result = await query(
        `
          SELECT id
          FROM users
          WHERE lower(email) = lower($1)
             OR lower(name) = lower($1)
          LIMIT 1
        `,
        [lookupValue],
      );

      cache.usersByLookup.set(cacheKey, result.rows[0]?.id || null);
    }

    const resolvedId = cache.usersByLookup.get(cacheKey);

    if (resolvedId) {
      resolvedIds.push(Number(resolvedId));
    }
  }

  return Array.from(new Set([...explicitIds, ...resolvedIds]));
};

const getCustomFieldDefinitionsByName = async (cache, projectId) => {
  const cacheKey = String(projectId || 'global');

  if (cache.customFieldsByProject.has(cacheKey)) {
    return cache.customFieldsByProject.get(cacheKey);
  }

  const result = await query(
    `
      SELECT id, name, field_type, is_required, options
      FROM custom_fields
      WHERE project_id = $1 OR project_id IS NULL
      ORDER BY project_id NULLS FIRST, sort_order, name
    `,
    [projectId],
  );
  const fieldsByName = new Map(result.rows.map((field) => [field.name.toLowerCase(), field]));

  cache.customFieldsByProject.set(cacheKey, fieldsByName);
  return fieldsByName;
};

const validateDateValue = (value, fieldLabel, errors) => {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();

  if (Number.isNaN(timestamp)) {
    errors.push(`${fieldLabel} tidak valid.`);
    return null;
  }

  return value;
};

const normalizeOptionalNumber = (value, fieldLabel, errors) => {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    errors.push(`${fieldLabel} harus angka.`);
    return null;
  }

  return numericValue;
};

const normalizeImportRow = async (row, index, options, cache, headersByNormalizedName) => {
  const fieldMapping = options.field_mapping || options.fieldMapping || {};
  const errors = [];
  const title = getMappedImportValue(row, headersByNormalizedName, fieldMapping, 'title');
  const projectId = await resolveProjectId({
    cache,
    projectId: getMappedImportValue(row, headersByNormalizedName, fieldMapping, 'project_id') || options.project_id || options.projectId || options.default_project_id,
    projectName: getMappedImportValue(row, headersByNormalizedName, fieldMapping, 'project_name'),
  });
  const issueTypeId = await resolveIssueTypeId({
    cache,
    issueTypeId: getMappedImportValue(row, headersByNormalizedName, fieldMapping, 'issue_type_id') || options.issue_type_id || options.issueTypeId || options.default_issue_type_id,
    issueTypeName: getMappedImportValue(row, headersByNormalizedName, fieldMapping, 'issue_type_name'),
    projectId,
  });
  const status = getMappedImportValue(row, headersByNormalizedName, fieldMapping, 'status') || 'Not Started';
  const priority = getMappedImportValue(row, headersByNormalizedName, fieldMapping, 'priority') || 'Medium';
  const startDate = validateDateValue(getMappedImportValue(row, headersByNormalizedName, fieldMapping, 'start_date'), 'Start date', errors);
  const endDate = validateDateValue(getMappedImportValue(row, headersByNormalizedName, fieldMapping, 'end_date'), 'End date', errors);
  const progress = normalizeOptionalNumber(getMappedImportValue(row, headersByNormalizedName, fieldMapping, 'progress'), 'Progress', errors);
  const storyPoints = normalizeOptionalNumber(getMappedImportValue(row, headersByNormalizedName, fieldMapping, 'story_points'), 'Story points', errors);
  const assigneeIds = await resolveUserIds({
    cache,
    assigneeEmailValue: getMappedImportValue(row, headersByNormalizedName, fieldMapping, 'assignee_email'),
    assigneeIdsValue: getMappedImportValue(row, headersByNormalizedName, fieldMapping, 'assignee_ids') || getMappedImportValue(row, headersByNormalizedName, fieldMapping, 'assignee_id'),
  });
  const customFields = getMappedCustomFieldValues(row, fieldMapping);

  if (!title) {
    errors.push('Title wajib diisi.');
  }

  if (!projectId) {
    errors.push('Project wajib diisi atau tidak ditemukan.');
  }

  if (!issueTypeId) {
    errors.push('Issue type wajib diisi atau tidak ditemukan.');
  }

  if (!VALID_STATUSES.includes(status)) {
    errors.push('Status tidak valid.');
  }

  if (!VALID_PRIORITIES.includes(priority)) {
    errors.push('Priority tidak valid.');
  }

  if (startDate && endDate && endDate < startDate) {
    errors.push('End date tidak boleh sebelum start date.');
  }

  if (progress !== null && (progress < 0 || progress > 100)) {
    errors.push('Progress harus berada di antara 0 dan 100.');
  }

  if (storyPoints !== null && storyPoints < 0) {
    errors.push('Story points tidak boleh negatif.');
  }

  if (projectId && Object.keys(customFields).length) {
    const customFieldDefinitions = await getCustomFieldDefinitionsByName(cache, projectId);
    const unknownCustomFields = Object.keys(customFields).filter(
      (fieldName) => !customFieldDefinitions.has(fieldName.toLowerCase()),
    );

    if (unknownCustomFields.length) {
      errors.push(`Custom field tidak ditemukan: ${unknownCustomFields.join(', ')}.`);
    }
  }

  return {
    errors,
    payload: {
      assignee_id: assigneeIds[0] || null,
      assignee_ids: assigneeIds,
      bucket_id: normalizePositiveInteger(getMappedImportValue(row, headersByNormalizedName, fieldMapping, 'bucket_id')),
      description: getMappedImportValue(row, headersByNormalizedName, fieldMapping, 'description') || null,
      end_date: endDate,
      environment: getMappedImportValue(row, headersByNormalizedName, fieldMapping, 'environment') || null,
      epic_id: normalizePositiveInteger(getMappedImportValue(row, headersByNormalizedName, fieldMapping, 'epic_id')),
      issue_type_id: issueTypeId,
      lead_id: normalizePositiveInteger(getMappedImportValue(row, headersByNormalizedName, fieldMapping, 'lead_id')),
      priority,
      progress: progress === null ? 0 : Math.round(progress),
      project_id: projectId,
      resolution: getMappedImportValue(row, headersByNormalizedName, fieldMapping, 'resolution') || null,
      sprint_id: normalizePositiveInteger(getMappedImportValue(row, headersByNormalizedName, fieldMapping, 'sprint_id')),
      start_date: startDate,
      status,
      story_points: storyPoints === null ? null : Math.round(storyPoints),
      title,
    },
    row,
    row_number: index + 2,
    custom_fields: customFields,
  };
};

const buildImportPreview = async (payload = {}) => {
  const { headers, rows } = parseImportRows(payload);

  if (rows.length > MAX_IMPORT_ROWS) {
    throw new Error(`Import maksimal ${MAX_IMPORT_ROWS} row per request.`);
  }

  const headersByNormalizedName = new Map(headers.map((header) => [normalizeHeader(header), header]));
  const cache = {
    customFieldsByProject: new Map(),
    issueTypesByName: new Map(),
    projectsByName: new Map(),
    usersByLookup: new Map(),
  };
  const previewRows = [];

  for (let index = 0; index < rows.length; index += 1) {
    previewRows.push(await normalizeImportRow(rows[index] || {}, index, payload, cache, headersByNormalizedName));
  }

  const acceptedRows = previewRows.filter((row) => row.errors.length === 0);
  const rejectedRows = previewRows.filter((row) => row.errors.length > 0);

  return {
    accepted_count: acceptedRows.length,
    headers,
    rejected_count: rejectedRows.length,
    rows: previewRows,
    total_rows: previewRows.length,
    valid: rejectedRows.length === 0,
  };
};

const saveCustomFieldValues = async (issueId, projectId, customFields, cache) => {
  const customFieldEntries = Object.entries(customFields || {}).filter(([, value]) => value !== undefined);

  if (!customFieldEntries.length) {
    return [];
  }

  const customFieldDefinitions = await getCustomFieldDefinitionsByName(cache, projectId);
  const savedValues = [];

  for (const [fieldName, value] of customFieldEntries) {
    const customField = customFieldDefinitions.get(fieldName.toLowerCase());

    if (!customField) {
      continue;
    }

    const result = await query(
      `
        INSERT INTO custom_field_values (issue_id, custom_field_id, value)
        VALUES ($1, $2, $3)
        ON CONFLICT (issue_id, custom_field_id) DO UPDATE
        SET value = EXCLUDED.value,
            updated_at = CURRENT_TIMESTAMP
        RETURNING id, custom_field_id, value
      `,
      [issueId, customField.id, value === null || value === undefined ? null : String(value)],
    );

    savedValues.push(result.rows[0]);
  }

  return savedValues;
};

const executeIssueImport = async (payload = {}, context = {}) => {
  const preview = await buildImportPreview(payload);
  const skipInvalid = normalizeBoolean(payload.skip_invalid ?? payload.skipInvalid, false);

  if (preview.rejected_count && !skipInvalid) {
    throw new Error('Import memiliki row tidak valid. Perbaiki data atau aktifkan skip_invalid.');
  }

  const cache = {
    customFieldsByProject: new Map(),
  };
  const successes = [];
  const failures = [];

  for (const row of preview.rows) {
    if (row.errors.length) {
      failures.push({
        errors: row.errors,
        row_number: row.row_number,
        skipped: true,
      });
      continue;
    }

    try {
      const createdIssue = await createTask(row.payload, context);
      const customFieldValues = await saveCustomFieldValues(createdIssue.id, row.payload.project_id, row.custom_fields, cache);

      successes.push({
        custom_field_values: customFieldValues,
        issue: createdIssue,
        row_number: row.row_number,
      });
    } catch (error) {
      failures.push({
        errors: [error.message || 'Import issue gagal.'],
        row_number: row.row_number,
      });
    }
  }

  await logActivity({
    actor_user_id: context.actor_user_id || context.user_id || null,
    action: 'issue_import.execute',
    object_type: 'issue_import',
    description: `Import issue diproses: ${successes.length} berhasil, ${failures.length} gagal.`,
    metadata: {
      failed_count: failures.length,
      source_format: payload.format || (Array.isArray(payload.issues) ? 'json' : 'csv'),
      succeeded_count: successes.length,
      total_rows: preview.total_rows,
    },
    project_id: normalizePositiveInteger(payload.project_id || payload.projectId || payload.default_project_id),
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  return {
    failed_count: failures.length,
    failures,
    preview,
    succeeded_count: successes.length,
    successes,
    total_rows: preview.total_rows,
  };
};

const escapeCsvCell = (value) => {
  const text = value === null || value === undefined ? '' : String(value);

  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
};

const escapeHtmlCell = (value) =>
  String(value === null || value === undefined ? '' : value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const createCsvContent = (rows = []) => {
  const headers = rows.length ? Object.keys(rows[0]) : STANDARD_EXPORT_COLUMNS.map((column) => column.label);
  const lines = [headers.map(escapeCsvCell).join(',')];

  rows.forEach((row) => {
    lines.push(headers.map((header) => escapeCsvCell(row[header])).join(','));
  });

  return lines.join('\r\n');
};

const createExcelHtmlContent = (rows = []) => {
  const headers = rows.length ? Object.keys(rows[0]) : STANDARD_EXPORT_COLUMNS.map((column) => column.label);
  const headerCells = headers.map((header) => `<th>${escapeHtmlCell(header)}</th>`).join('');
  const bodyRows = rows
    .map((row) => `<tr>${headers.map((header) => `<td>${escapeHtmlCell(row[header])}</td>`).join('')}</tr>`)
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8" /></head><body><table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table></body></html>`;
};

const canViewSensitiveFields = async (user) => {
  if (ELEVATED_ROLES.has(normalizeRole(user?.role))) {
    return true;
  }

  return hasPermission(user, 'task', 'read_sensitive');
};

const getVisibleExportColumns = async (user, requestedFields = []) => {
  const requestedFieldSet = requestedFields.length
    ? new Set(requestedFields.map((field) => normalizeString(field).toLowerCase()))
    : null;
  const canReadSensitiveFields = await canViewSensitiveFields(user);

  return STANDARD_EXPORT_COLUMNS.filter((column) => {
    if (column.sensitive && !canReadSensitiveFields) {
      return false;
    }

    if (!requestedFieldSet) {
      return true;
    }

    return requestedFieldSet.has(column.key.toLowerCase()) || requestedFieldSet.has(column.label.toLowerCase());
  });
};

const buildExportWhereClause = (payload = {}, context = {}) => {
  const jql = normalizeString(payload.jql || payload.jql_query || payload.jqlQuery);

  if (jql) {
    const builtQuery = buildJqlQuery(jql, {
      actor_user_id: context.actor_user_id || context.user_id || context.user?.id,
      only_member_projects: true,
      project_id: payload.project_id || payload.projectId,
    });

    return {
      orderSql: builtQuery.orderSql,
      parameters: builtQuery.parameters,
      whereSql: builtQuery.whereSql,
    };
  }

  const conditions = ['t.deleted_at IS NULL'];
  const parameters = [];
  const actorUserId = normalizePositiveInteger(context.actor_user_id || context.user_id || context.user?.id);
  const projectId = normalizePositiveInteger(payload.project_id || payload.projectId);
  const issueIds = (payload.issue_ids || payload.issueIds || [])
    .map((issueId) => normalizePositiveInteger(issueId))
    .filter(Boolean);

  if (projectId) {
    parameters.push(projectId);
    conditions.push(`t.project_id = $${parameters.length}`);
  }

  if (issueIds.length) {
    parameters.push(Array.from(new Set(issueIds)));
    conditions.push(`t.id = ANY($${parameters.length}::INTEGER[])`);
  }

  if (!ELEVATED_ROLES.has(normalizeRole(context.user?.role)) && actorUserId) {
    parameters.push(actorUserId);
    conditions.push(`(
      p.owner_id = $${parameters.length}
      OR EXISTS (
        SELECT 1
        FROM project_members pm_export
        WHERE pm_export.project_id = t.project_id
          AND pm_export.user_id = $${parameters.length}
      )
    )`);
  }

  return {
    orderSql: 't.updated_at DESC, t.id DESC',
    parameters,
    whereSql: conditions.join(' AND '),
  };
};

const getExportIssues = async (payload = {}, context = {}) => {
  const limit = normalizeExportLimit(payload.limit);
  const builtQuery = buildExportWhereClause(payload, context);
  const parameters = [...builtQuery.parameters, limit];
  const limitPlaceholder = `$${parameters.length}`;

  const result = await query(
    `
      SELECT
        t.id,
        t.issue_key,
        t.title,
        t.description,
        t.project_id,
        p.name AS project_name,
        p.project_key,
        t.issue_type_id,
        issue_type.name AS issue_type_name,
        t.status,
        t.priority,
        assignee.name AS assignee_name,
        COALESCE(assignee_summary.assignee_names, assignee.name, '') AS assignee_names,
        assignee.email AS assignee_email,
        lead_user.name AS lead_name,
        to_char(t.start_date, 'YYYY-MM-DD') AS start_date,
        to_char(t.end_date, 'YYYY-MM-DD') AS end_date,
        t.progress,
        t.story_points,
        t.epic_id,
        epic.epic_name,
        t.sprint_id,
        s.name AS sprint_name,
        b.name AS bucket_name,
        t.workflow_state_id,
        workflow_state.name AS workflow_state_name,
        t.resolution,
        t.environment,
        t.created_at,
        t.updated_at,
        COALESCE(custom_field_summary.custom_fields, '{}'::JSONB) AS custom_fields
      FROM tasks t
      INNER JOIN projects p ON p.id = t.project_id
      LEFT JOIN buckets b ON b.id = t.bucket_id
      LEFT JOIN users assignee ON assignee.id = t.assignee_id
      LEFT JOIN users creator ON creator.id = t.creator_id
      LEFT JOIN users lead_user ON lead_user.id = t.lead_id
      LEFT JOIN issue_types issue_type ON issue_type.id = t.issue_type_id
      LEFT JOIN sprints s ON s.id = t.sprint_id
      LEFT JOIN epics epic ON epic.id = t.epic_id
      LEFT JOIN workflow_states workflow_state ON workflow_state.id = t.workflow_state_id
      LEFT JOIN LATERAL (
        SELECT string_agg(DISTINCT assigned_user.name, ', ' ORDER BY assigned_user.name) AS assignee_names
        FROM task_assignees ta
        INNER JOIN users assigned_user ON assigned_user.id = ta.user_id
        WHERE ta.task_id = t.id
      ) assignee_summary ON TRUE
      LEFT JOIN LATERAL (
        SELECT jsonb_object_agg(cf.name, cfv.value ORDER BY cf.sort_order, cf.name) AS custom_fields
        FROM custom_field_values cfv
        INNER JOIN custom_fields cf ON cf.id = cfv.custom_field_id
        WHERE cfv.issue_id = t.id
      ) custom_field_summary ON TRUE
      WHERE ${builtQuery.whereSql}
      ORDER BY ${builtQuery.orderSql}
      LIMIT ${limitPlaceholder}
    `,
    parameters,
  );

  return result.rows;
};

const createExportRows = async (issues, payload, context) => {
  const columns = await getVisibleExportColumns(context.user, payload.fields || []);
  const includeCustomFields = normalizeBoolean(payload.include_custom_fields ?? payload.includeCustomFields, true);
  const canReadCustomFields = includeCustomFields && (await hasPermission(context.user, 'custom_field', 'read'));

  return issues.map((issue) => {
    const row = {};

    columns.forEach((column) => {
      row[column.label] = issue[column.key] ?? '';
    });

    if (canReadCustomFields) {
      Object.entries(issue.custom_fields || {}).forEach(([fieldName, value]) => {
        row[`Custom: ${fieldName}`] = value ?? '';
      });
    }

    return row;
  });
};

const createJsonIssues = async (issues, payload, context) => {
  const columns = await getVisibleExportColumns(context.user, payload.fields || []);
  const visibleKeys = new Set(columns.map((column) => column.key));
  const includeCustomFields = normalizeBoolean(payload.include_custom_fields ?? payload.includeCustomFields, true);
  const canReadCustomFields = includeCustomFields && (await hasPermission(context.user, 'custom_field', 'read'));

  return issues.map((issue) => {
    const output = {};

    visibleKeys.forEach((key) => {
      output[key] = issue[key] ?? null;
    });

    if (canReadCustomFields) {
      output.custom_fields = issue.custom_fields || {};
    }

    return output;
  });
};

const getExportFileName = (prefix, format) => {
  const extension = format === EXPORT_FORMATS.EXCEL ? 'xls' : format;
  const safePrefix = normalizeString(prefix || 'issues')
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '') || 'issues';

  return `${safePrefix}-${new Date().toISOString().slice(0, 10)}.${extension}`;
};

const exportIssues = async (payload = {}, context = {}) => {
  const format = normalizeString(payload.format || EXPORT_FORMATS.CSV).toLowerCase();

  if (!Object.values(EXPORT_FORMATS).includes(format)) {
    throw new Error('Format export tidak valid.');
  }

  const issues = await getExportIssues(payload, context);
  const rows = await createExportRows(issues, payload, context);
  const jsonIssues = format === EXPORT_FORMATS.JSON ? await createJsonIssues(issues, payload, context) : null;
  const content = format === EXPORT_FORMATS.JSON
    ? JSON.stringify(jsonIssues, null, 2)
    : format === EXPORT_FORMATS.EXCEL
      ? createExcelHtmlContent(rows)
      : createCsvContent(rows);

  await logActivity({
    actor_user_id: context.actor_user_id || context.user_id || null,
    action: 'issue_export.execute',
    object_type: 'issue_export',
    description: `Export ${issues.length} issue ke format ${format}.`,
    metadata: {
      format,
      issue_count: issues.length,
      jql: payload.jql || payload.jql_query || null,
      project_id: payload.project_id || payload.projectId || null,
    },
    project_id: normalizePositiveInteger(payload.project_id || payload.projectId),
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  return {
    content,
    content_type: EXPORT_MIME_TYPES[format],
    file_name: getExportFileName(payload.file_name_prefix || payload.fileNamePrefix, format),
    format,
    issue_count: issues.length,
    rows,
  };
};

module.exports = {
  EXPORT_FORMATS,
  buildImportPreview,
  createCsvContent,
  executeIssueImport,
  exportIssues,
  parseCsv,
  parseJsonIssues,
};
