const { query } = require('../config/db');
const { logActivity } = require('./activityService');

// Supported field types
const FIELD_TYPES = [
  'text',
  'number',
  'date',
  'select',
  'multi_select',
  'user',
  'checkbox',
  'url',
];

/**
 * Get all custom fields for a project (including global fields)
 * @param {number|null} projectId - Project ID or null for global fields only
 * @returns {Promise<Array>} Array of custom fields
 */
const getCustomFields = async (projectId = null) => {
  const result = await query(
    `
    SELECT 
      id,
      name,
      description,
      field_type,
      options,
      is_required,
      default_value,
      applicable_issue_types,
      sort_order,
      project_id,
      created_at,
      updated_at
    FROM custom_fields
    WHERE project_id IS NULL OR project_id = $1
    ORDER BY sort_order, name
    `,
    [projectId]
  );

  return result.rows;
};

/**
 * Get a single custom field by ID
 * @param {number} id - Custom field ID
 * @returns {Promise<Object|null>} Custom field object or null
 */
const getCustomFieldById = async (id) => {
  const result = await query(
    `
    SELECT 
      id,
      name,
      description,
      field_type,
      options,
      is_required,
      default_value,
      applicable_issue_types,
      sort_order,
      project_id,
      created_at,
      updated_at
    FROM custom_fields
    WHERE id = $1
    `,
    [id]
  );

  return result.rows[0] || null;
};

/**
 * Create a new custom field
 * @param {Object} data - Custom field data
 * @param {Object} context - Activity context
 * @returns {Promise<Object>} Created custom field
 */
const createCustomField = async (data, context = {}) => {
  const {
    name,
    description = null,
    field_type = 'text',
    options = [],
    is_required = false,
    default_value = null,
    applicable_issue_types = [],
    sort_order = 0,
    project_id = null,
  } = data;

  // Validate field type
  if (!FIELD_TYPES.includes(field_type)) {
    throw new Error(`Invalid field type. Supported types: ${FIELD_TYPES.join(', ')}`);
  }

  // Validate name is unique within project scope
  const existingResult = await query(
    `
    SELECT id FROM custom_fields
    WHERE name = $1 AND (project_id IS NULL OR project_id = $2)
    `,
    [name, project_id]
  );

  if (existingResult.rows.length > 0) {
    throw new Error(`Custom field "${name}" already exists.`);
  }

  // Validate options for select fields
  if ((field_type === 'select' || field_type === 'multi_select') && (!options || options.length === 0)) {
    throw new Error('Select fields must have at least one option.');
  }

  const result = await query(
    `
    INSERT INTO custom_fields (
      name,
      description,
      field_type,
      options,
      is_required,
      default_value,
      applicable_issue_types,
      sort_order,
      project_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
    `,
    [
      name,
      description,
      field_type,
      JSON.stringify(options),
      is_required,
      default_value,
      applicable_issue_types,
      sort_order,
      project_id,
    ]
  );

  const customField = result.rows[0];

  await logActivity({
    actor_user_id: context.actor_user_id || null,
    action: 'custom_field.create',
    object_type: 'custom_field',
    object_id: customField.id,
    description: `Custom field "${customField.name}" created.`,
    metadata: { name, field_type, project_id },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  return customField;
};

/**
 * Update a custom field
 * @param {number} id - Custom field ID
 * @param {Object} data - Updated data
 * @param {Object} context - Activity context
 * @returns {Promise<Object>} Updated custom field
 */
const updateCustomField = async (id, data, context = {}) => {
  const currentField = await getCustomFieldById(id);

  if (!currentField) {
    throw new Error('Custom field not found.');
  }

  const {
    name = currentField.name,
    description = currentField.description,
    field_type = currentField.field_type,
    options = currentField.options,
    is_required = currentField.is_required,
    default_value = currentField.default_value,
    applicable_issue_types = currentField.applicable_issue_types,
    sort_order = currentField.sort_order,
  } = data;

  // Validate field type
  if (!FIELD_TYPES.includes(field_type)) {
    throw new Error(`Invalid field type. Supported types: ${FIELD_TYPES.join(', ')}`);
  }

  // Check for name conflict if name is being changed
  if (name !== currentField.name) {
    const existingResult = await query(
      `
      SELECT id FROM custom_fields
      WHERE name = $1 AND (project_id IS NULL OR project_id = $2) AND id != $3
      `,
      [name, currentField.project_id, id]
    );

    if (existingResult.rows.length > 0) {
      throw new Error(`Custom field "${name}" already exists.`);
    }
  }

  const result = await query(
    `
    UPDATE custom_fields
    SET 
      name = $1,
      description = $2,
      field_type = $3,
      options = $4,
      is_required = $5,
      default_value = $6,
      applicable_issue_types = $7,
      sort_order = $8,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $9
    RETURNING *
    `,
    [
      name,
      description,
      field_type,
      JSON.stringify(options),
      is_required,
      default_value,
      applicable_issue_types,
      sort_order,
      id,
    ]
  );

  const customField = result.rows[0];

  await logActivity({
    actor_user_id: context.actor_user_id || null,
    action: 'custom_field.update',
    object_type: 'custom_field',
    object_id: customField.id,
    description: `Custom field "${customField.name}" updated.`,
    metadata: { changes: data },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });

  return customField;
};

/**
 * Delete a custom field
 * @param {number} id - Custom field ID
 * @param {Object} context - Activity context
 * @returns {Promise<void>}
 */
const deleteCustomField = async (id, context = {}) => {
  const customField = await getCustomFieldById(id);

  if (!customField) {
    throw new Error('Custom field not found.');
  }

  // Delete all values first
  await query('DELETE FROM custom_field_values WHERE custom_field_id = $1', [id]);

  // Delete the field
  await query('DELETE FROM custom_fields WHERE id = $1', [id]);

  await logActivity({
    actor_user_id: context.actor_user_id || null,
    action: 'custom_field.delete',
    object_type: 'custom_field',
    object_id: id,
    description: `Custom field "${customField.name}" deleted.`,
    metadata: { name: customField.name },
    ip_address: context.ip_address,
    user_agent: context.user_agent,
  });
};

/**
 * Validate a custom field value
 * @param {number} fieldId - Custom field ID
 * @param {any} value - Value to validate
 * @returns {Promise<Object>} Validation result
 */
const validateCustomFieldValue = async (fieldId, value) => {
  const field = await getCustomFieldById(fieldId);

  if (!field) {
    throw new Error('Custom field not found.');
  }

  // Check required
  if (field.is_required && (value === null || value === undefined || value === '')) {
    return { valid: false, message: `Field "${field.name}" is required.` };
  }

  // If value is empty and not required, it's valid
  if (value === null || value === undefined || value === '') {
    return { valid: true };
  }

  // Type-specific validation
  switch (field.field_type) {
    case 'text':
      if (typeof value !== 'string') {
        return { valid: false, message: `Field "${field.name}" must be text.` };
      }
      break;

    case 'number':
      if (typeof value !== 'number' || Number.isNaN(value)) {
        return { valid: false, message: `Field "${field.name}" must be a number.` };
      }
      break;

    case 'date':
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return { valid: false, message: `Field "${field.name}" must be a valid date.` };
      }
      break;

    case 'select':
      if (!field.options.some(opt => opt.value === value || opt === value)) {
        return { valid: false, message: `Invalid option for field "${field.name}".` };
      }
      break;

    case 'multi_select':
      if (!Array.isArray(value)) {
        return { valid: false, message: `Field "${field.name}" must be an array.` };
      }
      for (const v of value) {
        if (!field.options.some(opt => opt.value === v || opt === v)) {
          return { valid: false, message: `Invalid option "${v}" for field "${field.name}".` };
        }
      }
      break;

    case 'user':
      if (typeof value !== 'number' && typeof value !== 'string') {
        return { valid: false, message: `Field "${field.name}" must be a user ID.` };
      }
      // Verify user exists
      const userResult = await query('SELECT id FROM users WHERE id = $1', [Number(value)]);
      if (userResult.rows.length === 0) {
        return { valid: false, message: `User not found for field "${field.name}".` };
      }
      break;

    case 'checkbox':
      if (typeof value !== 'boolean') {
        return { valid: false, message: `Field "${field.name}" must be true or false.` };
      }
      break;

    case 'url':
      if (typeof value !== 'string') {
        return { valid: false, message: `Field "${field.name}" must be text.` };
      }
      try {
        new URL(value);
      } catch {
        return { valid: false, message: `Field "${field.name}" must be a valid URL.` };
      }
      break;

    default:
      break;
  }

  return { valid: true };
};

/**
 * Get custom field values for an issue
 * @param {number} issueId - Issue/Task ID
 * @returns {Promise<Array>} Array of custom field values
 */
const getCustomFieldValues = async (issueId) => {
  const result = await query(
    `
    SELECT 
      cfv.id,
      cfv.issue_id,
      cfv.custom_field_id,
      cfv.value,
      cfv.created_at,
      cfv.updated_at,
      cf.name AS field_name,
      cf.field_type,
      cf.is_required
    FROM custom_field_values cfv
    INNER JOIN custom_fields cf ON cf.id = cfv.custom_field_id
    WHERE cfv.issue_id = $1
    ORDER BY cf.sort_order, cf.name
    `,
    [issueId]
  );

  return result.rows;
};

/**
 * Set a custom field value for an issue
 * @param {number} issueId - Issue/Task ID
 * @param {number} fieldId - Custom field ID
 * @param {any} value - Field value
 * @param {Object} context - Activity context
 * @returns {Promise<Object>} Created/updated value
 */
const setCustomFieldValue = async (issueId, fieldId, value, context = {}) => {
  // Validate the value
  const validation = await validateCustomFieldValue(fieldId, value);
  if (!validation.valid) {
    throw new Error(validation.message);
  }

  // Verify issue exists
  const issueResult = await query('SELECT id, project_id FROM tasks WHERE id = $1', [issueId]);
  if (issueResult.rows.length === 0) {
    throw new Error('Issue not found.');
  }

  // Verify field is applicable to the issue's project
  const field = await getCustomFieldById(fieldId);
  if (field.project_id && field.project_id !== issueResult.rows[0].project_id) {
    throw new Error('Custom field is not applicable to this issue.');
  }

  // Upsert the value
  const result = await query(
    `
    INSERT INTO custom_field_values (issue_id, custom_field_id, value)
    VALUES ($1, $2, $3)
    ON CONFLICT (issue_id, custom_field_id)
    DO UPDATE SET value = $3, updated_at = CURRENT_TIMESTAMP
    RETURNING *
    `,
    [issueId, fieldId, value?.toString() || null]
  );

  return result.rows[0];
};

/**
 * Set multiple custom field values for an issue
 * @param {number} issueId - Issue/Task ID
 * @param {Object} values - Object with field IDs as keys and values as values
 * @param {Object} context - Activity context
 * @returns {Promise<Array>} Array of created/updated values
 */
const setCustomFieldValues = async (issueId, values, context = {}) => {
  const results = [];

  for (const [fieldId, value] of Object.entries(values)) {
    const result = await setCustomFieldValue(issueId, Number(fieldId), value, context);
    results.push(result);
  }

  return results;
};

/**
 * Get a specific custom field value for an issue
 * @param {number} issueId - Issue/Task ID
 * @param {number} fieldId - Custom field ID
 * @returns {Promise<Object|null>} Custom field value or null
 */
const getCustomFieldValue = async (issueId, fieldId) => {
  const result = await query(
    `
    SELECT 
      cfv.id,
      cfv.issue_id,
      cfv.custom_field_id,
      cfv.value,
      cfv.created_at,
      cfv.updated_at,
      cf.name AS field_name,
      cf.field_type,
      cf.is_required
    FROM custom_field_values cfv
    INNER JOIN custom_fields cf ON cf.id = cfv.custom_field_id
    WHERE cfv.issue_id = $1 AND cfv.custom_field_id = $2
    `,
    [issueId, fieldId]
  );

  return result.rows[0] || null;
};

/**
 * Delete a custom field value
 * @param {number} issueId - Issue/Task ID
 * @param {number} fieldId - Custom field ID
 * @returns {Promise<void>}
 */
const deleteCustomFieldValue = async (issueId, fieldId) => {
  await query(
    'DELETE FROM custom_field_values WHERE issue_id = $1 AND custom_field_id = $2',
    [issueId, fieldId]
  );
};

/**
 * Delete all custom field values for an issue
 * @param {number} issueId - Issue/Task ID
 * @returns {Promise<void>}
 */
const deleteAllCustomFieldValues = async (issueId) => {
  await query('DELETE FROM custom_field_values WHERE issue_id = $1', [issueId]);
};

/**
 * Get custom fields applicable to an issue type
 * @param {number|null} projectId - Project ID
 * @param {string} issueTypeName - Issue type name
 * @returns {Promise<Array>} Array of applicable custom fields
 */
const getApplicableCustomFields = async (projectId, issueTypeName) => {
  const result = await query(
    `
    SELECT 
      id,
      name,
      description,
      field_type,
      options,
      is_required,
      default_value,
      applicable_issue_types,
      sort_order,
      project_id,
      created_at,
      updated_at
    FROM custom_fields
    WHERE 
      (project_id IS NULL OR project_id = $1)
      AND (
        applicable_issue_types IS NULL 
        OR array_length(applicable_issue_types, 1) IS NULL
        OR $2 = ANY(applicable_issue_types)
      )
    ORDER BY sort_order, name
    `,
    [projectId, issueTypeName]
  );

  return result.rows;
};

/**
 * Get applicable fields for an issue type (alias for getApplicableCustomFields)
 * @param {string} issueTypeName - Issue type name
 * @param {number|null} projectId - Project ID
 * @returns {Promise<Array>} Array of applicable custom fields
 */
const getFieldsForIssueType = async (issueTypeName, projectId = null) => {
  return getApplicableCustomFields(projectId, issueTypeName);
};

module.exports = {
  createCustomField,
  deleteAllCustomFieldValues,
  deleteCustomField,
  deleteCustomFieldValue,
  getApplicableCustomFields,
  getCustomFieldById,
  getCustomFieldValue,
  getCustomFieldValues,
  getCustomFields,
  getFieldsForIssueType,
  setCustomFieldValue,
  setCustomFieldValues,
  updateCustomField,
  validateCustomFieldValue,
};
